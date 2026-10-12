-- Phase 2B: authenticated Squad Master and project/squad effort planning.
-- Physical deletion remains unavailable to Data API roles.

do $$
declare
  stored_count integer;
  actual_count integer;
begin
  select active_squad_count
  into stored_count
  from public.planning_limits
  where singleton;

  select count(*)
  into actual_count
  from public.squads
  where active;

  if stored_count is distinct from actual_count then
    raise exception
      'planning_limits active count (%) does not match squads (%)',
      stored_count,
      actual_count
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.squads
    where active
    group by lower(btrim(display_name))
    having count(*) > 1
  ) then
    raise exception
      'Duplicate active squad names must be resolved before Phase 2B migration'
      using errcode = '23505';
  end if;
end;
$$;

create unique index squads_active_display_name_idx
  on public.squads (lower(btrim(display_name)))
  where active;

-- The counter must update the protected planning_limits singleton when a
-- browser role creates, archives, or reactivates a squad. It is trigger-only.
alter function public.planning_track_active_squad_count()
  owner to postgres;

alter function public.planning_track_active_squad_count()
  security definer;

alter function public.planning_track_active_squad_count()
  set search_path = '';

revoke execute on function public.planning_track_active_squad_count()
  from public, anon, authenticated;

create table public.project_squad_efforts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  squad_id uuid not null references public.squads(id) on delete restrict,
  dev_md numeric(12,2) not null default 0 check (dev_md >= 0),
  qa_md numeric(12,2) not null default 0 check (qa_md >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_squad_efforts_project_squad_key unique (project_id, squad_id)
);

create index project_squad_efforts_project_id_idx
  on public.project_squad_efforts (project_id);

create index project_squad_efforts_squad_id_idx
  on public.project_squad_efforts (squad_id);

create index project_squad_efforts_active_project_idx
  on public.project_squad_efforts (project_id, squad_id)
  where archived_at is null;

create trigger project_squad_efforts_set_updated_at
before update on public.project_squad_efforts
for each row execute function public.planning_set_updated_at();

create or replace function public.planning_guard_effort_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.project_id is distinct from new.project_id
     or old.squad_id is distinct from new.squad_id then
    raise exception 'Project and squad identities cannot be changed'
      using errcode = '23514';
  end if;

  if old.archived_at is not null
     and (
       old.dev_md is distinct from new.dev_md
       or old.qa_md is distinct from new.qa_md
     ) then
    raise exception 'Archived effort values cannot be changed'
      using errcode = '23514';
  end if;

  if old.archived_at is distinct from new.archived_at
     and (
       old.dev_md is distinct from new.dev_md
       or old.qa_md is distinct from new.qa_md
     ) then
    raise exception 'Effort values cannot be changed while archiving or restoring'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function public.planning_guard_effort_history()
  owner to postgres;

revoke execute on function public.planning_guard_effort_history()
  from public, anon, authenticated;

create trigger project_squad_efforts_guard_history
before update on public.project_squad_efforts
for each row execute function public.planning_guard_effort_history();

create or replace function public.planning_archive_inactive_squad_efforts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.project_squad_efforts
  set archived_at = now()
  where squad_id = new.id
    and archived_at is null;

  return new;
end;
$$;

alter function public.planning_archive_inactive_squad_efforts()
  owner to postgres;

revoke execute on function public.planning_archive_inactive_squad_efforts()
  from public, anon, authenticated;

create trigger squads_archive_effort_assignments
after update of active on public.squads
for each row
when (old.active and not new.active)
execute function public.planning_archive_inactive_squad_efforts();

alter table public.project_squad_efforts enable row level security;

revoke all on table public.squads from anon, authenticated;
revoke all on table public.project_squad_efforts from anon, authenticated;

grant select on table public.squads to authenticated;
grant insert (display_name, active, display_order)
  on table public.squads to authenticated;
grant update (display_name, active, display_order)
  on table public.squads to authenticated;

grant select on table public.project_squad_efforts to authenticated;
grant insert (project_id, squad_id, dev_md, qa_md)
  on table public.project_squad_efforts to authenticated;
grant update (dev_md, qa_md, archived_at)
  on table public.project_squad_efforts to authenticated;

create policy squads_authenticated_select
on public.squads
for select
to authenticated
using (true);

create policy squads_authenticated_insert
on public.squads
for insert
to authenticated
with check (true);

create policy squads_authenticated_update
on public.squads
for update
to authenticated
using (true)
with check (true);

create policy project_squad_efforts_authenticated_select
on public.project_squad_efforts
for select
to authenticated
using (true);

create policy project_squad_efforts_authenticated_insert
on public.project_squad_efforts
for insert
to authenticated
with check (
  archived_at is null
  and exists (
    select 1
    from public.projects
    where projects.id = project_squad_efforts.project_id
      and projects.archived_at is null
  )
  and exists (
    select 1
    from public.squads
    where squads.id = project_squad_efforts.squad_id
      and squads.active
  )
);

create policy project_squad_efforts_authenticated_update
on public.project_squad_efforts
for update
to authenticated
using (true)
with check (
  archived_at is not null
  or (
    exists (
      select 1
      from public.projects
      where projects.id = project_squad_efforts.project_id
        and projects.archived_at is null
    )
    and exists (
      select 1
      from public.squads
      where squads.id = project_squad_efforts.squad_id
        and squads.active
    )
  )
);
