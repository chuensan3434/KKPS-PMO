-- Shared Sprint Calendar and Squad Capacity Planner. Additive and data preserving.
-- Production application remains authenticated-only; anon receives no privileges.

alter table public.people add column default_availability_pct numeric(5,2) not null default 100
  check (default_availability_pct between 0 and 100);

alter table public.sprint_calendars drop constraint if exists sprint_calendars_cadence_days_check;
alter table public.sprint_calendars add constraint sprint_calendars_cadence_days_check check (cadence_days between 7 and 28);

alter table public.sprints drop constraint if exists sprints_check;
alter table public.sprints drop constraint if exists sprints_check1;
alter table public.sprints drop constraint if exists sprints_check2;
alter table public.sprints add constraint sprints_valid_dates check (
  display_end_date >= start_date and coverage_end_date >= display_end_date
);

create table public.work_types (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  display_order integer not null default 0 check (display_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index work_types_active_name_idx on public.work_types (lower(btrim(display_name))) where archived_at is null;
create trigger work_types_set_updated_at before update on public.work_types for each row execute function public.planning_set_updated_at();

create table public.allocation_rows (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete restrict,
  member_id uuid not null references public.people(id) on delete restrict,
  work_type_id uuid not null references public.work_types(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index allocation_rows_active_identity_idx on public.allocation_rows (squad_id, member_id, work_type_id) where archived_at is null;
create index allocation_rows_squad_idx on public.allocation_rows (squad_id) where archived_at is null;
create trigger allocation_rows_set_updated_at before update on public.allocation_rows for each row execute function public.planning_set_updated_at();

create table public.sprint_allocations (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.allocation_rows(id) on delete restrict,
  sprint_id uuid not null references public.sprints(id) on delete restrict,
  allocation_pct numeric(5,2) not null default 0 check (allocation_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (row_id, sprint_id)
);
create index sprint_allocations_sprint_idx on public.sprint_allocations (sprint_id);
create trigger sprint_allocations_set_updated_at before update on public.sprint_allocations for each row execute function public.planning_set_updated_at();

create table public.member_sprint_availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.people(id) on delete restrict,
  sprint_id uuid not null references public.sprints(id) on delete restrict,
  availability_pct numeric(5,2) not null default 100 check (availability_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, sprint_id)
);
create trigger member_sprint_availability_set_updated_at before update on public.member_sprint_availability for each row execute function public.planning_set_updated_at();

insert into public.work_types (display_name, display_order)
values ('Dev', 0), ('SA', 1), ('App Support', 2), ('Tech Debt', 3)
on conflict do nothing;

alter table public.work_types enable row level security;
alter table public.allocation_rows enable row level security;
alter table public.sprint_allocations enable row level security;
alter table public.member_sprint_availability enable row level security;

revoke all on table public.work_types, public.allocation_rows, public.sprint_allocations, public.member_sprint_availability from anon, authenticated;
grant select, insert, update on table public.work_types, public.allocation_rows, public.sprint_allocations, public.member_sprint_availability to authenticated;
grant select, insert, update on table public.people, public.squad_memberships to authenticated;
grant insert, update on table public.sprint_calendars, public.sprints to authenticated;

create policy people_authenticated_select on public.people for select to authenticated using (true);
create policy people_authenticated_insert on public.people for insert to authenticated with check (true);
create policy people_authenticated_update on public.people for update to authenticated using (true) with check (true);
create policy squad_memberships_authenticated_select on public.squad_memberships for select to authenticated using (true);
create policy squad_memberships_authenticated_insert on public.squad_memberships for insert to authenticated with check (true);
create policy squad_memberships_authenticated_update on public.squad_memberships for update to authenticated using (true) with check (true);
create policy sprint_calendars_authenticated_insert on public.sprint_calendars for insert to authenticated with check (true);
create policy sprint_calendars_authenticated_update on public.sprint_calendars for update to authenticated using (true) with check (true);
create policy sprints_authenticated_insert on public.sprints for insert to authenticated with check (true);
create policy sprints_authenticated_update on public.sprints for update to authenticated using (true) with check (true);

create policy work_types_authenticated_all on public.work_types for all to authenticated using (true) with check (true);
create policy allocation_rows_authenticated_all on public.allocation_rows for all to authenticated using (true) with check (
  exists (select 1 from public.squad_memberships m where m.person_id = member_id and m.squad_id = squad_id)
);
create policy sprint_allocations_authenticated_all on public.sprint_allocations for all to authenticated using (true) with check (true);
create policy member_sprint_availability_authenticated_all on public.member_sprint_availability for all to authenticated using (true) with check (true);
