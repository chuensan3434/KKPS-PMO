create table public.project_quarter_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  planned_year integer not null check (planned_year between 2000 and 2100),
  start_quarter smallint not null check (start_quarter between 1 and 4),
  end_quarter smallint not null check (end_quarter between 1 and 4 and end_quarter >= start_quarter),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index project_quarter_plans_active_project_year_idx
  on public.project_quarter_plans (project_id, planned_year)
  where archived_at is null;
create index project_quarter_plans_year_range_idx
  on public.project_quarter_plans (planned_year, start_quarter, end_quarter)
  where archived_at is null;

create trigger project_quarter_plans_set_updated_at
before update on public.project_quarter_plans
for each row execute function public.planning_set_updated_at();

create function public.project_quarter_plans_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.archived_at is not null then
    raise exception using errcode = '23514', message = 'Archived quarter plans are immutable';
  end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.planned_year <> old.planned_year) then
    raise exception using errcode = '23514', message = 'Quarter plan identity is immutable';
  end if;
  return new;
end;
$$;

create trigger project_quarter_plans_guard
before insert or update on public.project_quarter_plans
for each row execute function public.project_quarter_plans_guard();

alter table public.project_quarter_plans enable row level security;
revoke all on table public.project_quarter_plans from anon, authenticated;
grant select on table public.project_quarter_plans to authenticated;
grant insert (project_id, planned_year, start_quarter, end_quarter) on table public.project_quarter_plans to authenticated;
grant update (start_quarter, end_quarter, archived_at) on table public.project_quarter_plans to authenticated;

create policy project_quarter_plans_authenticated_select
on public.project_quarter_plans for select to authenticated using (true);
create policy project_quarter_plans_authenticated_insert
on public.project_quarter_plans for insert to authenticated
with check (exists (select 1 from public.projects where projects.id = project_quarter_plans.project_id and projects.archived_at is null));
create policy project_quarter_plans_authenticated_update
on public.project_quarter_plans for update to authenticated
using (exists (select 1 from public.projects where projects.id = project_quarter_plans.project_id and projects.archived_at is null))
with check (exists (select 1 from public.projects where projects.id = project_quarter_plans.project_id and projects.archived_at is null));

revoke execute on function public.project_quarter_plans_guard() from public, anon, authenticated;

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
  plan_year integer;
  plan_start smallint;
  plan_end smallint;
  created_projects integer := 0;
  created_efforts integer := 0;
  created_quarter_plans integer := 0;
  skipped_projects integer := 0;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'An authenticated session is required.'; end if;
  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) = 0 then raise exception using errcode = '22023', message = 'Import payload must contain at least one project.'; end if;
  if exists (select 1 from jsonb_array_elements(payload) item group by lower(trim(item->>'project_name')) having count(*) > 1) then raise exception using errcode = '23505', message = 'Import payload contains duplicate project names.'; end if;

  for project_item in select value from jsonb_array_elements(payload)
  loop
    normalized_name := trim(project_item->>'project_name');
    if normalized_name is null or length(normalized_name) = 0 then raise exception using errcode = '23514', message = 'Every imported project requires a name.'; end if;
    if exists (select 1 from public.projects where archived_at is null and lower(trim(project_name)) = lower(normalized_name)) then skipped_projects := skipped_projects + 1; continue; end if;
    if coalesce(jsonb_typeof(project_item->'efforts'), 'array') <> 'array' then raise exception using errcode = '22023', message = 'Project efforts must be an array.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(project_item->'efforts', '[]'::jsonb)) effort where not exists (select 1 from public.squads where id = (effort->>'squad_id')::uuid and active)) then raise exception using errcode = '23503', message = 'An imported effort references an unknown or inactive Squad.'; end if;

    plan_year := nullif(project_item->>'planned_year', '')::integer;
    plan_start := nullif(project_item->>'start_quarter', '')::smallint;
    plan_end := nullif(project_item->>'end_quarter', '')::smallint;
    if (plan_year is null) <> (plan_start is null) or (plan_year is null) <> (plan_end is null) then raise exception using errcode = '23514', message = 'Quarter plans require year, start quarter, and end quarter together.'; end if;

    insert into public.projects (project_name, description, business_unit, owner_name, target_date, status, metadata)
    values (normalized_name, nullif(trim(project_item->>'description'), ''), nullif(trim(project_item->>'business_unit'), ''), nullif(trim(project_item->>'owner_name'), ''), nullif(project_item->>'target_date', '')::date, coalesce(nullif(project_item->>'status', ''), 'draft'), '{}'::jsonb)
    returning id into created_project_id;
    created_projects := created_projects + 1;

    for effort_item in select value from jsonb_array_elements(coalesce(project_item->'efforts', '[]'::jsonb))
    loop
      insert into public.project_squad_efforts (project_id, squad_id, dev_md, qa_md)
      values (created_project_id, (effort_item->>'squad_id')::uuid, (effort_item->>'dev_md')::numeric, (effort_item->>'qa_md')::numeric);
      created_efforts := created_efforts + 1;
    end loop;

    if plan_year is not null then
      insert into public.project_quarter_plans (project_id, planned_year, start_quarter, end_quarter)
      values (created_project_id, plan_year, plan_start, plan_end);
      created_quarter_plans := created_quarter_plans + 1;
    end if;
  end loop;

  return jsonb_build_object('created_projects', created_projects, 'created_efforts', created_efforts, 'created_quarter_plans', created_quarter_plans, 'skipped_projects', skipped_projects);
end;
$$;

revoke execute on function public.import_projects_with_efforts(jsonb) from public, anon;
grant execute on function public.import_projects_with_efforts(jsonb) to authenticated;
