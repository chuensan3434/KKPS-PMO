alter table public.projects
  add column business_unit text,
  add column owner_name text,
  add column target_date date;

alter table public.projects
  add constraint projects_business_unit_length_check
    check (business_unit is null or length(trim(business_unit)) between 1 and 120),
  add constraint projects_owner_name_length_check
    check (owner_name is null or length(trim(owner_name)) between 1 and 160);

comment on column public.projects.business_unit is 'Optional business unit supplied during project intake.';
comment on column public.projects.owner_name is 'Optional PO or business owner display name.';
comment on column public.projects.target_date is 'Optional business target date; not a sprint schedule.';
