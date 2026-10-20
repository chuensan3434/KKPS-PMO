begin;
select plan(8);

select has_function('public', 'import_projects_with_efforts', array['jsonb'], 'Transactional import RPC exists');
select function_privs_are('public', 'import_projects_with_efforts', array['jsonb'], 'anon', array[]::text[], 'Anonymous role cannot execute import');
select function_privs_are('public', 'import_projects_with_efforts', array['jsonb'], 'authenticated', array['EXECUTE'], 'Authenticated role can execute import');

insert into public.squads (display_name, active, display_order) values ('Import Squad', true, 999);

-- Use dynamic SQL for the generated Squad id while preserving a single RPC call.
set local role authenticated;
select lives_ok((
  select format('select public.import_projects_with_efforts(%L::jsonb)', jsonb_build_array(jsonb_build_object(
    'project_name', 'Imported Project',
    'description', null,
    'business_unit', 'PWM',
    'owner_name', 'PO A',
    'target_date', null,
    'status', 'draft',
    'efforts', jsonb_build_array(jsonb_build_object('squad_id', id, 'dev_md', 2, 'qa_md', 1))
  ))::text)
  from public.squads where display_name = 'Import Squad'
), 'Authenticated import succeeds');
select public.import_projects_with_efforts((
  select jsonb_build_array(jsonb_build_object(
    'project_name', 'Imported Project', 'status', 'draft',
    'efforts', jsonb_build_array(jsonb_build_object('squad_id', id, 'dev_md', 2, 'qa_md', 1))
  )) from public.squads where display_name = 'Import Squad'
));
reset role;

select is((select count(*)::integer from public.projects where project_name = 'Imported Project'), 1, 'RPC creates one project');
select is((select count(*)::integer from public.project_squad_efforts effort join public.projects project on project.id = effort.project_id where project.project_name = 'Imported Project'), 1, 'RPC creates its effort');
select is((select business_unit from public.projects where project_name = 'Imported Project'), 'PWM', 'RPC stores typed project fields');
select is((select count(*)::integer from public.projects where project_name = 'Imported Project'), 1, 'Repeated existing names are not duplicated');

select * from finish();
rollback;
