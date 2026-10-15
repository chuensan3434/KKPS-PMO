begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'project_roadmap_schedules', 'Roadmap schedule table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.project_roadmap_schedules'::regclass), 'Roadmap schedules have RLS');

insert into public.projects (project_name) values ('Schedule Project');
insert into public.sprint_calendars (code, display_name, baseline_start_date) values ('schedule-2027', 'Schedule 2027', date '2027-01-04');
insert into public.sprints (calendar_id, sprint_code, sequence_number, start_date, display_end_date, coverage_end_date)
select calendar.id, 'RS-' || sequence_number, sequence_number, date '2027-01-04' + ((sequence_number - 1) * 14), date '2027-01-04' + ((sequence_number - 1) * 14) + 11, date '2027-01-04' + ((sequence_number - 1) * 14) + 13
from public.sprint_calendars calendar cross join generate_series(1, 4) sequence_number where calendar.code = 'schedule-2027';

select lives_ok(
  $$insert into public.project_roadmap_schedules (project_id, calendar_id, start_sprint, end_sprint)
    select project.id, calendar.id, 1, 3 from public.projects project cross join public.sprint_calendars calendar
    where project.project_name = 'Schedule Project' and calendar.code = 'schedule-2027'$$,
  'valid Roadmap schedule inserts'
);
select throws_ok(
  $$insert into public.project_roadmap_schedules (project_id, calendar_id, start_sprint, end_sprint)
    select project.id, calendar.id, 2, 4 from public.projects project cross join public.sprint_calendars calendar
    where project.project_name = 'Schedule Project' and calendar.code = 'schedule-2027'$$,
  '23505', null, 'one active schedule per Project and calendar'
);
select throws_ok($$delete from public.sprints where sprint_code = 'RS-2'$$, '23503', 'Sprint is referenced by an active Roadmap schedule', 'covered Sprint deletion is rejected');
select lives_ok($$update public.project_roadmap_schedules set start_sprint = 2, end_sprint = 4 where archived_at is null$$, 'schedule range updates');
select lives_ok($$update public.project_roadmap_schedules set archived_at = now() where archived_at is null$$, 'schedule archives');
select throws_ok($$update public.project_roadmap_schedules set start_sprint = 1 where archived_at is not null$$, '23514', 'Archived Roadmap schedules are immutable', 'archived schedules are immutable');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'project_roadmap_schedules'), 3, 'schedule table has three policies');
select ok(not has_table_privilege('anon', 'public.project_roadmap_schedules', 'select'), 'anonymous select denied');
select ok(not has_table_privilege('anon', 'public.project_roadmap_schedules', 'insert'), 'anonymous insert denied');
select ok(has_table_privilege('authenticated', 'public.project_roadmap_schedules', 'select'), 'authenticated select granted');
select ok(has_column_privilege('authenticated', 'public.project_roadmap_schedules', 'project_id', 'insert'), 'authenticated insert granted');
select ok(has_column_privilege('authenticated', 'public.project_roadmap_schedules', 'start_sprint', 'update'), 'authenticated range update granted');
select ok(not has_table_privilege('authenticated', 'public.project_roadmap_schedules', 'delete'), 'authenticated physical delete denied');
select ok(not has_column_privilege('authenticated', 'public.project_roadmap_schedules', 'project_id', 'update'), 'schedule identity update denied');

select * from finish();
rollback;
