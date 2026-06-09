create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'beta',
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  procedure_date date not null default current_date,
  wafer_number text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year text,
  vehicle_domain text,
  injection text,
  vehicle_type text,
  owner_name text not null,
  owner_street text,
  owner_street_number text,
  postal_code text,
  city text,
  province text,
  phone text,
  document_type text,
  document_number text,
  regulator_actual_code text,
  regulator_actual_serial text,
  regulator_install_code text,
  regulator_install_serial text,
  regulator_remove_code text,
  regulator_remove_serial text,
  regulator_cancel_code text,
  regulator_cancel_serial text,
  cylinder_code text,
  cylinder_serial text,
  cylinder_new text,
  cylinder_manufacture_date text,
  cylinder_review_date text,
  cylinder_crpc text,
  cylinder_operation text,
  valve_code text,
  valve_serial text,
  valve_operation text,
  wafer_due date,
  hydraulic_due date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_type text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.procedures enable row level security;
alter table public.attachments enable row level security;

drop policy if exists "members can view organizations" on public.organizations;
drop policy if exists "users can create own organizations" on public.organizations;
drop policy if exists "members can view members" on public.organization_members;
drop policy if exists "users can create own membership" on public.organization_members;
drop policy if exists "members can manage procedures" on public.procedures;
drop policy if exists "members can manage attachments" on public.attachments;

create policy "members can view organizations"
on public.organizations for select
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id
    and m.user_id = auth.uid()
  )
);

create policy "users can create own organizations"
on public.organizations for insert
with check (owner_id = auth.uid());

create policy "members can view members"
on public.organization_members for select
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id
    and m.user_id = auth.uid()
  )
);

create policy "users can create own membership"
on public.organization_members for insert
with check (user_id = auth.uid());

create policy "members can manage procedures"
on public.procedures for all
using (
  (organization_id is null and user_id = auth.uid())
  or exists (
    select 1 from public.organization_members m
    where m.organization_id = procedures.organization_id
    and m.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = procedures.organization_id
      and m.user_id = auth.uid()
    )
  )
);

create policy "members can manage attachments"
on public.attachments for all
using (
  (organization_id is null and user_id = auth.uid())
  or exists (
    select 1 from public.organization_members m
    where m.organization_id = attachments.organization_id
    and m.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = attachments.organization_id
      and m.user_id = auth.uid()
    )
  )
);
