-- Sprint Calendar versions allow adjusted dates, but each version must remain ordered and non-overlapping.
create or replace function public.planning_validate_sprint_calendar_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.display_end_date < new.start_date or new.coverage_end_date < new.display_end_date then
    raise exception 'Sprint dates must satisfy start <= display end <= coverage end' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.sprints sprint
    where sprint.calendar_id = new.calendar_id
      and sprint.id is distinct from new.id
      and (
        (sprint.sequence_number < new.sequence_number and sprint.coverage_end_date >= new.start_date)
        or (sprint.sequence_number > new.sequence_number and new.coverage_end_date >= sprint.start_date)
      )
  ) then
    raise exception 'Sprint dates must follow sequence order and cannot overlap within a calendar' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.planning_validate_sprint_calendar_dates() from public, anon, authenticated;

create trigger sprints_validate_calendar_dates
before insert or update of calendar_id, sequence_number, start_date, display_end_date, coverage_end_date
on public.sprints
for each row execute function public.planning_validate_sprint_calendar_dates();
