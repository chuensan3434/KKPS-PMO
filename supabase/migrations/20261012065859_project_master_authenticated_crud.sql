-- Temporary Phase 1.6 access model: every authenticated KKPS-PMO user can
-- manage the shared Project Master. Role-specific authorization is deferred.
-- Anonymous access and physical DELETE remain denied.

grant usage on schema public to authenticated;
grant select, insert, update on table public.projects to authenticated;

create policy projects_authenticated_select
on public.projects
for select
to authenticated
using (true);

create policy projects_authenticated_insert
on public.projects
for insert
to authenticated
with check (true);

create policy projects_authenticated_update
on public.projects
for update
to authenticated
using (true)
with check (true);
