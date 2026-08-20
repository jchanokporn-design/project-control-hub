-- ============================================================
-- Migration 0006 — User Type Master + user-type assignments
-- Run this in Supabase SQL editor (after 0001-0005)
-- ============================================================

-- ---------------------------------------------------------
-- Master list of "types" a user can be tagged with (e.g. IT,
-- Construction). Admin can add more later — not locked to 2.
-- ---------------------------------------------------------
create table public.user_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Many-to-many: one user can belong to more than one type
-- (e.g. someone who works across both IT and Construction).
create table public.user_type_assignments (
  user_id uuid not null references public.users(id) on delete cascade,
  user_type_id uuid not null references public.user_types(id) on delete cascade,
  primary key (user_id, user_type_id)
);

-- Seed the 2 starting types mentioned in the requirements — matched
-- by name (case-insensitively) against projects.type ('it' / 'construction')
-- for the "filter PM by project type" feature. Admin can rename/add more;
-- only types named exactly "IT" or "Construction" (any case) participate
-- in that specific auto-filter — additional types are just for general
-- categorization until/unless that matching logic is extended later.
insert into public.user_types (name) values ('IT'), ('Construction')
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- RLS: everyone logged in can read (needed to render the type
-- picker and the filtered PM dropdown); only Admin can write.
-- ---------------------------------------------------------
alter table public.user_types enable row level security;
alter table public.user_type_assignments enable row level security;

create policy "user_types_select" on public.user_types for select using (true);
create policy "user_types_admin_write" on public.user_types for all
  using (public.is_admin()) with check (public.is_admin());

create policy "uta_select" on public.user_type_assignments for select using (true);
create policy "uta_admin_write" on public.user_type_assignments for all
  using (public.is_admin()) with check (public.is_admin());
