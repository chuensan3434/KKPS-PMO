begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

select has_table('public', 'squad_capacity_periods', 'capacity period table exists');
select has_index('public', 'squad_capacity_periods', 'squad_capacity_periods_squad_id_idx', 'squad foreign key has a standalone index');
select ok((select relrowsecurity from pg_class where oid = 'public.squad_capacity_periods'::regclass), 'capacity periods have RLS enabled');

insert into public.squads (display_name, display_order) values
  ('Capacity Squad A', 0),
  ('Capacity Squad B', 1);

insert into public.sprint_calendars (code, display_name, baseline_start_date) values
  ('capacity-complete', 'Capacity Complete', date '2027-01-04'),
  ('capacity-gap', 'Capacity Gap', date '2028-01-03');

insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
select calendar.id, 'C-S' || sequence_number, sequence_number,
  date '2027-01-04' + ((sequence_number - 1) * 14),
  date '2027-01-04' + ((sequence_number - 1) * 14) + 11,
  date '2027-01-04' + ((sequence_number - 1) * 14) + 13
from public.sprint_calendars calendar
cross join generate_series(1, 6) sequence_number
where calendar.code = 'capacity-complete';

insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
select calendar.id, 'G-S1', 1, date '2028-01-03', date '2028-01-14', date '2028-01-16'
from public.sprint_calendars calendar where calendar.code = 'capacity-gap';
insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
select calendar.id, 'G-S3', 3, date '2028-01-31', date '2028-02-11', date '2028-02-13'
from public.sprint_calendars calendar where calendar.code = 'capacity-gap';

select lives_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 1, 2, 20, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'valid capacity period inserts'
);
select is((select count(*)::integer from public.squad_capacity_periods where start_sprint = 1 and end_sprint = 2), 1, 'valid period is stored');

select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 2, 3, 20, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  '23P01', null, 'inclusive boundary overlap is rejected'
);
select lives_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 3, 4, 25, 'override'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'adjacent non-overlapping period inserts'
);
select lives_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 5, 5, 0, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'zero capacity inserts'
);
select is((select capacity_md from public.squad_capacity_periods where start_sprint = 5), 0::numeric, 'zero capacity is stored as zero');

select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 6, 6, -1, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  '23514', null, 'negative capacity is rejected'
);
select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 6, 6, 'NaN'::numeric, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'NaN capacity is rejected'
);
select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 6, 6, 'Infinity'::numeric, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'infinite capacity is rejected'
);
select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 7, 7, 10, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  '23503', null, 'missing Sprint endpoint is rejected'
);
select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 1, 3, 10, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad B' and calendar.code = 'capacity-gap'$$,
  '23514', 'Capacity period range contains missing Sprint sequences', 'missing intermediate Sprint is rejected'
);

select lives_ok(
  $$update public.squad_capacity_periods set archived_at = now() where start_sprint = 1 and end_sprint = 2$$,
  'archive-only transition succeeds'
);
select throws_ok(
  $$update public.squad_capacity_periods set capacity_md = 30, archived_at = now() where start_sprint = 3 and end_sprint = 4$$,
  '23514', 'Archiving may only change archived_at', 'business fields cannot change while archiving'
);
select throws_ok(
  $$update public.squad_capacity_periods set capacity_md = 30 where start_sprint = 1 and end_sprint = 2$$,
  '23514', 'Archived capacity periods are immutable', 'archived business fields are immutable'
);
select throws_ok(
  $$update public.squad_capacity_periods set archived_at = now() + interval '1 hour' where start_sprint = 1 and end_sprint = 2$$,
  '23514', 'Archived capacity periods are immutable', 'archive timestamp is immutable'
);
select throws_ok(
  $$update public.squad_capacity_periods set archived_at = null where start_sprint = 1 and end_sprint = 2$$,
  '23514', 'Archived capacity periods are immutable', 'archived periods cannot be restored'
);
select lives_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 1, 2, 22, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'archived range can be reused by a new period'
);

select throws_ok(
  $$update public.squad_capacity_periods set squad_id = (select id from public.squads where display_name = 'Capacity Squad B')
    where start_sprint = 3 and end_sprint = 4$$,
  '23514', 'Capacity period squad and calendar cannot be changed', 'squad identity is immutable'
);
select throws_ok(
  $$update public.squad_capacity_periods set calendar_id = (select id from public.sprint_calendars where code = 'capacity-gap')
    where start_sprint = 3 and end_sprint = 4$$,
  '23514', 'Capacity period squad and calendar cannot be changed', 'calendar identity is immutable'
);
select throws_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 6, 6, 10, 'imported'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  '23514', null, 'unsupported source is rejected'
);

select throws_ok(
  $$delete from public.sprints where calendar_id = (select id from public.sprint_calendars where code = 'capacity-complete') and sequence_number = 1$$,
  '23503', 'Sprint is referenced by an active capacity period', 'covered Sprint deletion is rejected'
);
select throws_ok(
  $$update public.sprints set sequence_number = 20 where calendar_id = (select id from public.sprint_calendars where code = 'capacity-complete') and sequence_number = 2$$,
  '23503', 'Sprint is referenced by an active capacity period', 'covered Sprint renumbering is rejected'
);

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'squad_capacity_periods'), 3, 'capacity table has select, insert, and update policies');
select ok(not has_table_privilege('anon', 'public.squad_capacity_periods', 'select'), 'anonymous select is denied');
select ok(not has_table_privilege('anon', 'public.squad_capacity_periods', 'insert'), 'anonymous insert is denied');
select ok(has_table_privilege('authenticated', 'public.squad_capacity_periods', 'select'), 'authenticated select is granted');
select ok(has_table_privilege('authenticated', 'public.squad_capacity_periods', 'insert'), 'authenticated insert is granted');
select ok(has_table_privilege('authenticated', 'public.squad_capacity_periods', 'update'), 'authenticated update is granted');
select ok(not has_table_privilege('authenticated', 'public.squad_capacity_periods', 'delete'), 'authenticated physical delete is denied');

set local role authenticated;
select lives_ok(
  $$insert into public.squad_capacity_periods (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source)
    select squad.id, calendar.id, 6, 6, 10, 'manual'
    from public.squads squad cross join public.sprint_calendars calendar
    where squad.display_name = 'Capacity Squad A' and calendar.code = 'capacity-complete'$$,
  'authenticated user can create a period through RLS'
);
select lives_ok(
  $$update public.squad_capacity_periods set capacity_md = 12 where start_sprint = 6 and end_sprint = 6$$,
  'authenticated user can update a period through RLS'
);
select is((select count(*)::integer from public.squad_capacity_periods where start_sprint = 6), 1, 'authenticated user can read through RLS');
select throws_ok(
  $$delete from public.squad_capacity_periods where start_sprint = 6 and end_sprint = 6$$,
  '42501', null, 'authenticated physical delete fails'
);
reset role;

select ok(has_table_privilege('authenticated', 'public.sprint_calendars', 'select'), 'authenticated can read Sprint calendars');
select ok(has_table_privilege('authenticated', 'public.sprints', 'select'), 'authenticated can read Sprints');

select * from finish();
rollback;
