-- Phase 2C: capacity by inclusive Sprint range. Additive and data-free.
create table public.squad_capacity_periods (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete restrict,
  calendar_id uuid not null references public.sprint_calendars(id) on delete restrict,
  start_sprint integer not null,
  end_sprint integer not null,
  capacity_md numeric(12,2) not null,
  source text not null default 'manual'
    check (source in ('manual', 'employee-derived', 'override')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_sprint > 0),
  check (end_sprint >= start_sprint),
  check (capacity_md >= 0 and capacity_md not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  foreign key (calendar_id, start_sprint) references public.sprints(calendar_id, sequence_number) on delete restrict,
  foreign key (calendar_id, end_sprint) references public.sprints(calendar_id, sequence_number) on delete restrict,
  exclude using gist (
    squad_id with =,
    calendar_id with =,
    int4range(start_sprint, end_sprint, '[]') with &&
  ) where (archived_at is null)
);

create index squad_capacity_periods_active_lookup_idx
  on public.squad_capacity_periods (calendar_id, squad_id, start_sprint)
  where archived_at is null;

create index squad_capacity_periods_squad_id_idx
  on public.squad_capacity_periods (squad_id);

create trigger squad_capacity_periods_set_updated_at
before update on public.squad_capacity_periods
for each row execute function public.planning_set_updated_at();

create or replace function public.planning_guard_capacity_period_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.squad_id is distinct from new.squad_id or old.calendar_id is distinct from new.calendar_id then
    raise exception 'Capacity period squad and calendar cannot be changed' using errcode = '23514';
  end if;

  if old.archived_at is not null then
    raise exception 'Archived capacity periods are immutable' using errcode = '23514';
  end if;

  if new.archived_at is not null
     and row(new.start_sprint, new.end_sprint, new.capacity_md, new.source)
       is distinct from row(old.start_sprint, old.end_sprint, old.capacity_md, old.source) then
    raise exception 'Archiving may only change archived_at' using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function public.planning_guard_capacity_period_identity() owner to postgres;
revoke execute on function public.planning_guard_capacity_period_identity() from public, anon, authenticated;

create trigger squad_capacity_periods_guard_identity
before update on public.squad_capacity_periods
for each row execute function public.planning_guard_capacity_period_identity();

-- Capacity writes and Sprint removal/renumbering serialize with the same
-- transaction-level advisory lock derived from calendar_id. Advisory locking
-- avoids granting browser roles UPDATE access to sprint_calendars.
create or replace function public.planning_validate_capacity_period_sprints()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actual_count integer;
  endpoint_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.calendar_id::text, 0)
  );

  select count(*)::integer
  into endpoint_count
  from public.sprints
  where calendar_id = new.calendar_id
    and sequence_number in (new.start_sprint, new.end_sprint);

  -- Let the declared foreign keys report missing start/end references.
  if endpoint_count <> (case when new.start_sprint = new.end_sprint then 1 else 2 end) then
    return new;
  end if;

  select count(*)::integer
  into actual_count
  from public.sprints
  where calendar_id = new.calendar_id
    and sequence_number between new.start_sprint and new.end_sprint;

  if actual_count <> new.end_sprint - new.start_sprint + 1 then
    raise exception 'Capacity period range contains missing Sprint sequences'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function public.planning_validate_capacity_period_sprints() owner to postgres;
revoke execute on function public.planning_validate_capacity_period_sprints() from public, anon, authenticated;

create trigger squad_capacity_periods_validate_sprints
before insert or update of start_sprint, end_sprint, archived_at on public.squad_capacity_periods
for each row execute function public.planning_validate_capacity_period_sprints();

create or replace function public.planning_protect_capacity_period_sprints()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(old.calendar_id::text, 0)
    );
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(calendar_id::text, 0)
    )
    from (
      select distinct calendar_id
      from (values (old.calendar_id), (new.calendar_id)) ids(calendar_id)
      order by calendar_id
    ) ordered_calendars;
  end if;

  if exists (
    select 1
    from public.squad_capacity_periods
    where archived_at is null
      and calendar_id = old.calendar_id
      and old.sequence_number between start_sprint and end_sprint
  ) then
    raise exception 'Sprint is referenced by an active capacity period'
      using errcode = '23503';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function public.planning_protect_capacity_period_sprints() owner to postgres;
revoke execute on function public.planning_protect_capacity_period_sprints() from public, anon, authenticated;

create trigger sprints_protect_capacity_periods
before delete or update of calendar_id, sequence_number on public.sprints
for each row execute function public.planning_protect_capacity_period_sprints();

alter table public.squad_capacity_periods enable row level security;
revoke all on table public.squad_capacity_periods from anon, authenticated;
revoke all on table public.sprint_calendars from anon, authenticated;
revoke all on table public.sprints from anon, authenticated;
grant select on table public.sprint_calendars to authenticated;
grant select on table public.sprints to authenticated;
grant select on table public.squad_capacity_periods to authenticated;
grant insert (squad_id, calendar_id, start_sprint, end_sprint, capacity_md, source) on table public.squad_capacity_periods to authenticated;
grant update (start_sprint, end_sprint, capacity_md, source, archived_at) on table public.squad_capacity_periods to authenticated;

create policy squad_capacity_periods_authenticated_select on public.squad_capacity_periods
for select to authenticated using (true);
create policy squad_capacity_periods_authenticated_insert on public.squad_capacity_periods
for insert to authenticated with check (archived_at is null);
create policy squad_capacity_periods_authenticated_update on public.squad_capacity_periods
for update to authenticated using (true) with check (true);

create policy sprint_calendars_authenticated_select on public.sprint_calendars
for select to authenticated using (true);
create policy sprints_authenticated_select on public.sprints
for select to authenticated using (true);
