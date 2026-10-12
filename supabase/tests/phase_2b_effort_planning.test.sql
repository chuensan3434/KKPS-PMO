begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public', 'project_squad_efforts', 'effort table exists');
select has_column('public', 'project_squad_efforts', 'project_id', 'project foreign key column exists');
select has_column('public', 'project_squad_efforts', 'squad_id', 'squad foreign key column exists');
select has_column('public', 'project_squad_efforts', 'dev_md', 'Dev MD column exists');
select has_column('public', 'project_squad_efforts', 'qa_md', 'QA MD column exists');
select has_column('public', 'project_squad_efforts', 'archived_at', 'archive timestamp exists');
select col_not_null('public', 'project_squad_efforts', 'dev_md', 'Dev MD is required');
select col_not_null('public', 'project_squad_efforts', 'qa_md', 'QA MD is required');
select has_index('public', 'project_squad_efforts', 'project_squad_efforts_project_squad_key', 'project/squad assignment is unique');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'project_squad_efforts'),
  3,
  'effort table has select, insert, and update policies'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.project_squad_efforts'::regclass),
  'effort table has RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.project_squad_efforts', 'select'), 'anonymous select is denied');
select ok(not has_table_privilege('anon', 'public.project_squad_efforts', 'insert'), 'anonymous insert is denied');
select ok(not has_table_privilege('anon', 'public.project_squad_efforts', 'update'), 'anonymous update is denied');
select ok(not has_table_privilege('authenticated', 'public.project_squad_efforts', 'delete'), 'authenticated physical delete is denied');
select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.planning_track_active_squad_count()'::regprocedure),
  'postgres',
  'active-squad counter is owned by postgres'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.planning_track_active_squad_count()'::regprocedure),
  'active-squad counter is security definer'
);
select is(
  (select proconfig[1] from pg_proc where oid = 'public.planning_track_active_squad_count()'::regprocedure),
  'search_path=""',
  'active-squad counter has an empty search path'
);
select ok(not has_function_privilege('anon', 'public.planning_track_active_squad_count()', 'execute'), 'anonymous cannot execute the counter directly');
select ok(not has_function_privilege('authenticated', 'public.planning_track_active_squad_count()', 'execute'), 'authenticated cannot execute the counter directly');
select has_trigger('public', 'squads', 'squads_archive_effort_assignments', 'squad archive trigger exists');
select has_trigger('public', 'project_squad_efforts', 'project_squad_efforts_guard_history', 'historical effort guard exists');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'squads'),
  3,
  'squads has select, insert, and update policies'
);
select ok(has_table_privilege('authenticated', 'public.squads', 'select'), 'authenticated can list squads');
select ok(has_column_privilege('authenticated', 'public.project_squad_efforts', 'dev_md', 'update'), 'authenticated can update Dev MD');
select ok(has_column_privilege('authenticated', 'public.project_squad_efforts', 'archived_at', 'update'), 'authenticated can archive and restore assignments');

select * from finish();

rollback;
