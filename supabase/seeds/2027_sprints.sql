-- Explicit opt-in development seed. config.toml references this path, but
-- automatic seeding is disabled. Review and run it only after approval.
insert into public.sprint_calendars (code, display_name, baseline_start_date)
values ('kkps-2027', 'KKPS 2027', date '2027-01-04')
on conflict (code) do nothing;

insert into public.sprints (
  calendar_id,
  sprint_code,
  sequence_number,
  start_date,
  display_end_date,
  coverage_end_date
)
select
  calendar.id,
  '2027-S' || sequence_number,
  sequence_number,
  date '2027-01-04' + ((sequence_number - 1) * 14),
  date '2027-01-04' + ((sequence_number - 1) * 14) + 11,
  date '2027-01-04' + ((sequence_number - 1) * 14) + 13
from public.sprint_calendars calendar
cross join generate_series(1, 26) as sequence_number
where calendar.code = 'kkps-2027'
on conflict (calendar_id, sequence_number) do nothing;
