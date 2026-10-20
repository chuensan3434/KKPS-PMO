-- Global non-working weekdays for the shared Sprint Calendar.
-- Existing Sprint rows remain valid with the zero-day default.
alter table public.sprints
  add column holiday_adjustment_days smallint not null default 0
  check (holiday_adjustment_days >= 0);

create or replace function public.planning_validate_sprint_holiday_adjustment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare base_weekdays integer;
begin
  select count(*)::integer into base_weekdays
  from generate_series(new.start_date, new.display_end_date, interval '1 day') as days(day_value)
  where extract(isodow from day_value) between 1 and 5;
  if new.holiday_adjustment_days > base_weekdays then
    raise exception 'Holiday / Non-working Days cannot exceed base weekdays' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.planning_validate_sprint_holiday_adjustment() from public, anon, authenticated;
create trigger sprints_validate_holiday_adjustment
before insert or update of start_date, display_end_date, holiday_adjustment_days on public.sprints
for each row execute function public.planning_validate_sprint_holiday_adjustment();

grant update (holiday_adjustment_days) on table public.sprints to authenticated;
