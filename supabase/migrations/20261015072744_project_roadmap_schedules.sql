-- Phase 2C.1: additive Roadmap schedule persistence using stable identities.
create table public.project_roadmap_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  calendar_id uuid not null references public.sprint_calendars(id) on delete restrict,
  start_sprint integer not null,
  end_sprint integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_sprint > 0),
  check (end_sprint >= start_sprint),
  foreign key (calendar_id, start_sprint) references public.sprints(calendar_id, sequence_number) on delete restrict,
  foreign key (calendar_id, end_sprint) references public.sprints(calendar_id, sequence_number) on delete restrict
);

create unique index project_roadmap_schedules_active_project_calendar_idx
  on public.project_roadmap_schedules (project_id, calendar_id)
  where archived_at is null;

create index project_roadmap_schedules_calendar_idx
  on public.project_roadmap_schedules (calendar_id, start_sprint)
  where archived_at is null;

create trigger project_roadmap_schedules_set_updated_at
before update on public.project_roadmap_schedules
for each row execute function public.planning_set_updated_at();

create or replace function public.planning_guard_roadmap_schedule()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare sprint_count integer;
begin
  if tg_op = 'UPDATE' then
    if old.project_id is distinct from new.project_id or old.calendar_id is distinct from new.calendar_id then
      raise exception 'Roadmap schedule project and calendar cannot be changed' using errcode = '23514';
    end if;
    if old.archived_at is not null then raise exception 'Archived Roadmap schedules are immutable' using errcode = '23514'; end if;
    if new.archived_at is not null and row(new.start_sprint, new.end_sprint) is distinct from row(old.start_sprint, old.end_sprint) then
      raise exception 'Archiving may only change archived_at' using errcode = '23514';
    end if;
  end if;
  if new.archived_at is null then
    select count(*)::integer into sprint_count from public.sprints
    where calendar_id = new.calendar_id and sequence_number between new.start_sprint and new.end_sprint;
    if sprint_count <> new.end_sprint - new.start_sprint + 1 then
      raise exception 'Roadmap schedule range contains missing Sprint sequences' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

alter function public.planning_guard_roadmap_schedule() owner to postgres;
revoke execute on function public.planning_guard_roadmap_schedule() from public, anon, authenticated;
create trigger project_roadmap_schedules_guard before insert or update on public.project_roadmap_schedules
for each row execute function public.planning_guard_roadmap_schedule();

create or replace function public.planning_protect_roadmap_sprints()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.project_roadmap_schedules
    where archived_at is null and calendar_id = old.calendar_id
      and old.sequence_number between start_sprint and end_sprint
  ) then
    raise exception 'Sprint is referenced by an active Roadmap schedule' using errcode = '23503';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function public.planning_protect_roadmap_sprints() owner to postgres;
revoke execute on function public.planning_protect_roadmap_sprints() from public, anon, authenticated;
create trigger sprints_protect_roadmap_schedules
before delete or update of calendar_id, sequence_number on public.sprints
for each row execute function public.planning_protect_roadmap_sprints();

alter table public.project_roadmap_schedules enable row level security;
revoke all on table public.project_roadmap_schedules from anon, authenticated;
grant select on table public.project_roadmap_schedules to authenticated;
grant insert (project_id, calendar_id, start_sprint, end_sprint) on table public.project_roadmap_schedules to authenticated;
grant update (start_sprint, end_sprint, archived_at) on table public.project_roadmap_schedules to authenticated;

create policy project_roadmap_schedules_authenticated_select on public.project_roadmap_schedules
for select to authenticated using (true);
create policy project_roadmap_schedules_authenticated_insert on public.project_roadmap_schedules
for insert to authenticated with check (
  archived_at is null
  and exists (select 1 from public.projects where projects.id = project_roadmap_schedules.project_id and projects.archived_at is null)
  and exists (select 1 from public.sprint_calendars where sprint_calendars.id = project_roadmap_schedules.calendar_id and sprint_calendars.active)
);
create policy project_roadmap_schedules_authenticated_update on public.project_roadmap_schedules
for update to authenticated using (true) with check (archived_at is not null or (
  exists (select 1 from public.projects where projects.id = project_roadmap_schedules.project_id and projects.archived_at is null)
  and exists (select 1 from public.sprint_calendars where sprint_calendars.id = project_roadmap_schedules.calendar_id and sprint_calendars.active)
));
