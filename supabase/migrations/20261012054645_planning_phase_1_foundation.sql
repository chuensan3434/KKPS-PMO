create extension if not exists btree_gist with schema extensions;

create or replace function public.planning_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  active boolean not null default true,
  display_order smallint not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index squads_active_display_order_idx
  on public.squads (display_order)
  where active;

create table public.planning_limits (
  singleton boolean primary key default true check (singleton),
  active_squad_count smallint not null default 0 check (active_squad_count between 0 and 15)
);

insert into public.planning_limits (singleton) values (true);

create or replace function public.planning_track_active_squad_count()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  delta integer := 0;
begin
  if tg_op = 'INSERT' and new.active then
    delta := 1;
  elsif tg_op = 'UPDATE' and old.active is distinct from new.active then
    delta := case when new.active then 1 else -1 end;
  elsif tg_op = 'DELETE' and old.active then
    delta := -1;
  end if;

  if delta = 0 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Updating the singleton row serializes concurrent activations. PostgreSQL's
  -- row-update recheck sees the latest committed count after lock waits.
  update public.planning_limits
  set active_squad_count = active_squad_count + delta
  where singleton and active_squad_count + delta between 0 and 15;

  if not found then
    raise exception 'At most 15 squads may be active'
      using errcode = '23514', constraint = 'squads_max_15_active';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger squads_active_limit_insert_update
before insert or update of active on public.squads
for each row execute function public.planning_track_active_squad_count();

create trigger squads_active_limit_delete
before delete on public.squads
for each row execute function public.planning_track_active_squad_count();

create trigger squads_set_updated_at
before update on public.squads
for each row execute function public.planning_set_updated_at();

create table public.squad_aliases (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete restrict,
  source_system text not null check (length(trim(source_system)) between 1 and 80),
  normalized_external_name text not null check (
    normalized_external_name = lower(trim(normalized_external_name))
    and length(normalized_external_name) between 1 and 160
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, normalized_external_name)
);

create index squad_aliases_squad_id_idx on public.squad_aliases (squad_id);
create trigger squad_aliases_set_updated_at
before update on public.squad_aliases
for each row execute function public.planning_set_updated_at();

create table public.people (
  id uuid primary key default gen_random_uuid(),
  employee_key text unique,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  active boolean not null default true,
  employment_start_date date,
  employment_end_date date,
  default_daily_hours numeric(4,2) not null default 8.00 check (default_daily_hours > 0 and default_daily_hours <= 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (employee_key is null or length(trim(employee_key)) > 0),
  check (employment_end_date is null or employment_start_date is null or employment_end_date >= employment_start_date)
);

create trigger people_set_updated_at
before update on public.people
for each row execute function public.planning_set_updated_at();

create table public.squad_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  squad_id uuid not null references public.squads(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (
    person_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);

create index squad_memberships_person_id_idx on public.squad_memberships (person_id);
create index squad_memberships_squad_id_idx on public.squad_memberships (squad_id);
create trigger squad_memberships_set_updated_at
before update on public.squad_memberships
for each row execute function public.planning_set_updated_at();

create table public.sprint_calendars (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 1 and 80),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  baseline_start_date date not null,
  cadence_days smallint not null default 14 check (cadence_days = 14),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sprint_calendars_set_updated_at
before update on public.sprint_calendars
for each row execute function public.planning_set_updated_at();

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.sprint_calendars(id) on delete restrict,
  sprint_code text not null check (length(trim(sprint_code)) between 1 and 80),
  sequence_number integer not null check (sequence_number > 0),
  start_date date not null,
  display_end_date date not null,
  coverage_end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, sprint_code),
  unique (calendar_id, sequence_number),
  unique (calendar_id, start_date),
  check (coverage_end_date = start_date + 13),
  check (display_end_date = start_date + 11),
  check (display_end_date <= coverage_end_date)
);

create index sprints_calendar_id_idx on public.sprints (calendar_id);
create trigger sprints_set_updated_at
before update on public.sprints
for each row execute function public.planning_set_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (length(trim(project_name)) between 1 and 200),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_status_idx on public.projects (status) where archived_at is null;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.planning_set_updated_at();

alter table public.squads enable row level security;
alter table public.planning_limits enable row level security;
alter table public.squad_aliases enable row level security;
alter table public.people enable row level security;
alter table public.squad_memberships enable row level security;
alter table public.sprint_calendars enable row level security;
alter table public.sprints enable row level security;
alter table public.projects enable row level security;

-- Authentication and authorization are intentionally postponed. RLS has no
-- policies and the Data API roles have no table privileges, so browser reads
-- and writes remain deny-all until an approved ownership model is migrated.
revoke all on table public.squads from anon, authenticated;
revoke all on table public.planning_limits from anon, authenticated;
revoke all on table public.squad_aliases from anon, authenticated;
revoke all on table public.people from anon, authenticated;
revoke all on table public.squad_memberships from anon, authenticated;
revoke all on table public.sprint_calendars from anon, authenticated;
revoke all on table public.sprints from anon, authenticated;
revoke all on table public.projects from anon, authenticated;

revoke execute on function public.planning_set_updated_at() from public, anon, authenticated;
revoke execute on function public.planning_track_active_squad_count() from public, anon, authenticated;
