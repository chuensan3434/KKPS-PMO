begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select has_table('public', 'squads', 'squads exists');
select has_table('public', 'people', 'people exists');
select has_table('public', 'squad_memberships', 'memberships exists');
select has_table('public', 'sprints', 'sprints exists');
select has_table('public', 'projects', 'projects exists');

insert into public.squads (display_name, display_order)
select 'Squad ' || value, value from generate_series(1, 15) value;
select throws_ok(
  $$insert into public.squads (display_name, display_order) values ('Squad 16', 16)$$,
  '23514', 'At most 15 squads may be active', 'sixteenth active squad is rejected'
);
select is((select active_squad_count::integer from public.planning_limits where singleton), 15, 'active squad counter remains at its limit after rejection');
insert into public.squads (display_name, display_order, active) values ('Historical Squad', 16, false);
select is((select count(*)::integer from public.squads where not active), 1, 'inactive squads are retained');

insert into public.squad_aliases (squad_id, source_system, normalized_external_name)
select id, 'actitime', 'external squad' from public.squads where display_order = 1;
update public.squads set display_name = 'Renamed Squad' where display_order = 1;
select is((select normalized_external_name from public.squad_aliases), 'external squad', 'rename preserves aliases');
select throws_ok(
  $$insert into public.squad_aliases (squad_id, source_system, normalized_external_name)
    select id, 'actitime', 'external squad' from public.squads where display_order = 2$$,
  '23505', null, 'source alias is unique'
);

insert into public.people (employee_key, display_name) values ('EMP-1', 'Person 1');
insert into public.squad_memberships (person_id, squad_id, effective_from, effective_to)
select person.id, squad.id, date '2027-01-01', date '2027-03-31'
from public.people person cross join public.squads squad
where person.employee_key = 'EMP-1' and squad.display_order = 1;
select throws_ok(
  $$insert into public.squad_memberships (person_id, squad_id, effective_from)
    select person.id, squad.id, date '2027-03-31'
    from public.people person cross join public.squads squad
    where person.employee_key = 'EMP-1' and squad.display_order = 2$$,
  '23P01', null, 'primary memberships cannot overlap'
);

insert into public.sprint_calendars (code, display_name, baseline_start_date)
values ('test-2027', 'Test 2027', date '2027-01-04');
insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
select id, '2027-S1', 1, date '2027-01-04', date '2027-01-15', date '2027-01-17'
from public.sprint_calendars where code = 'test-2027';
select throws_ok(
  $$insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
    select id, '2027-DUPLICATE', 1, date '2027-01-18', date '2027-01-29', date '2027-01-31'
    from public.sprint_calendars where code = 'test-2027'$$,
  '23505', null, 'sprint sequence is unique per calendar'
);
select throws_ok(
  $$insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
    select id, '2027-S2', 2, date '2027-01-18', date '2027-01-30', date '2027-01-31'
    from public.sprint_calendars where code = 'test-2027'$$,
  '23514', null, 'display end must follow the existing second-Friday convention'
);

select throws_ok(
  $$insert into public.squad_aliases (squad_id, source_system, normalized_external_name)
    values ('00000000-0000-0000-0000-000000000000', 'actitime', 'missing')$$,
  '23503', null, 'foreign keys reject missing squads'
);

select ok((select relrowsecurity from pg_class where oid = 'public.squads'::regclass), 'squads RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.people'::regclass), 'people RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), 'projects RLS enabled');
select is(has_table_privilege('anon', 'public.squads', 'select'), false, 'anon cannot read squads');
select is(has_table_privilege('authenticated', 'public.squads', 'insert'), false, 'authenticated cannot insert squads');
select is(has_table_privilege('authenticated', 'public.projects', 'select'), true, 'authenticated can read projects');
select is(has_table_privilege('authenticated', 'public.projects', 'insert'), true, 'authenticated can create projects');
select is(has_table_privilege('authenticated', 'public.projects', 'update'), true, 'authenticated can update projects');
select is(has_table_privilege('authenticated', 'public.projects', 'delete'), false, 'authenticated cannot physically delete projects');
select is(has_table_privilege('anon', 'public.projects', 'select'), false, 'anon cannot read projects');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'projects'), 3, 'projects has authenticated select, insert, and update policies');

select * from finish();
rollback;
