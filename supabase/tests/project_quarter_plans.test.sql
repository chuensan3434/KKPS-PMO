begin;
select plan(10);

select has_table('public', 'project_quarter_plans', 'Quarter-plan table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.project_quarter_plans'::regclass), 'Quarter plans have RLS');
select ok(not has_table_privilege('anon', 'public.project_quarter_plans', 'select'), 'Anonymous reads are denied');
select ok(has_table_privilege('authenticated', 'public.project_quarter_plans', 'select'), 'Authenticated reads are granted');
select ok(not has_table_privilege('authenticated', 'public.project_quarter_plans', 'delete'), 'Physical delete is denied');

insert into public.projects (project_name, status) values ('Quarter Test', 'active');
insert into public.project_quarter_plans (project_id, planned_year, start_quarter, end_quarter)
select id, 2027, 1, 3 from public.projects where project_name = 'Quarter Test';

select is((select count(*)::integer from public.project_quarter_plans where planned_year = 2027), 1, 'Quarter plan can be created');
select throws_ok(
  $$insert into public.project_quarter_plans (project_id, planned_year, start_quarter, end_quarter) select id, 2027, 3, 2 from public.projects where project_name = 'Quarter Test'$$,
  '23514', null, 'Invalid quarter range is rejected'
);
select throws_ok(
  $$insert into public.project_quarter_plans (project_id, planned_year, start_quarter, end_quarter) select id, 2027, 2, 4 from public.projects where project_name = 'Quarter Test'$$,
  '23505', null, 'Only one active plan per project and year is allowed'
);
select lives_ok($$update public.project_quarter_plans set start_quarter = 2 where planned_year = 2027$$, 'Quarter range can be updated');
select lives_ok($$update public.project_quarter_plans set archived_at = now() where planned_year = 2027$$, 'Quarter plan can be archived');

select * from finish();
rollback;
