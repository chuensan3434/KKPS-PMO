create or replace function public.import_projects_with_efforts(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_item jsonb;
  effort_item jsonb;
  created_project_id uuid;
  normalized_name text;
  created_projects integer := 0;
  created_efforts integer := 0;
  skipped_projects integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An authenticated session is required.';
  end if;

  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) = 0 then
    raise exception using errcode = '22023', message = 'Import payload must contain at least one project.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payload) item
    group by lower(trim(item->>'project_name'))
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'Import payload contains duplicate project names.';
  end if;

  for project_item in select value from jsonb_array_elements(payload)
  loop
    normalized_name := trim(project_item->>'project_name');
    if normalized_name is null or length(normalized_name) = 0 then
      raise exception using errcode = '23514', message = 'Every imported project requires a name.';
    end if;

    if exists (
      select 1 from public.projects
      where archived_at is null and lower(trim(project_name)) = lower(normalized_name)
    ) then
      skipped_projects := skipped_projects + 1;
      continue;
    end if;

    if coalesce(jsonb_typeof(project_item->'efforts'), 'array') <> 'array' then
      raise exception using errcode = '22023', message = 'Project efforts must be an array.';
    end if;

    if exists (
      select 1 from jsonb_array_elements(coalesce(project_item->'efforts', '[]'::jsonb)) effort
      where not exists (
        select 1 from public.squads
        where id = (effort->>'squad_id')::uuid and active
      )
    ) then
      raise exception using errcode = '23503', message = 'An imported effort references an unknown or inactive Squad.';
    end if;

    insert into public.projects (
      project_name, description, business_unit, owner_name, target_date, status, metadata
    ) values (
      normalized_name,
      nullif(trim(project_item->>'description'), ''),
      nullif(trim(project_item->>'business_unit'), ''),
      nullif(trim(project_item->>'owner_name'), ''),
      nullif(project_item->>'target_date', '')::date,
      coalesce(nullif(project_item->>'status', ''), 'draft'),
      '{}'::jsonb
    ) returning id into created_project_id;
    created_projects := created_projects + 1;

    for effort_item in select value from jsonb_array_elements(coalesce(project_item->'efforts', '[]'::jsonb))
    loop
      insert into public.project_squad_efforts (project_id, squad_id, dev_md, qa_md)
      values (
        created_project_id,
        (effort_item->>'squad_id')::uuid,
        (effort_item->>'dev_md')::numeric,
        (effort_item->>'qa_md')::numeric
      );
      created_efforts := created_efforts + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'created_projects', created_projects,
    'created_efforts', created_efforts,
    'skipped_projects', skipped_projects
  );
end;
$$;

revoke execute on function public.import_projects_with_efforts(jsonb) from public, anon;
grant execute on function public.import_projects_with_efforts(jsonb) to authenticated;

comment on function public.import_projects_with_efforts(jsonb) is
  'Atomically imports new projects and their Squad efforts. Existing active project names are skipped and never overwritten.';
