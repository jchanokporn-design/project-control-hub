-- ============================================================
-- Migration 0008 — Fix RLS for types & user_type_assignments,
-- Admin Deadlock prevention & explicit write permissions
-- Run this in Supabase SQL editor (after 0001-0007)
-- ============================================================

-- 1. Ensure RLS is enabled on all core tables
alter table if exists public.types enable row level security;
alter table if exists public.user_type_assignments enable row level security;
alter table if exists public.users enable row level security;

-- 2. Drop existing policies on types to recreate them cleanly
drop policy if exists "user_types_select" on public.types;
drop policy if exists "user_types_admin_write" on public.types;
drop policy if exists "types_select" on public.types;
drop policy if exists "types_admin_write" on public.types;
drop policy if exists "types_select_all" on public.types;
drop policy if exists "types_admin_insert" on public.types;
drop policy if exists "types_admin_update" on public.types;
drop policy if exists "types_admin_delete" on public.types;

-- 3. Drop existing policies on user_type_assignments
drop policy if exists "uta_select" on public.user_type_assignments;
drop policy if exists "uta_admin_write" on public.user_type_assignments;
drop policy if exists "uta_select_all" on public.user_type_assignments;
drop policy if exists "uta_admin_insert" on public.user_type_assignments;
drop policy if exists "uta_admin_update" on public.user_type_assignments;
drop policy if exists "uta_admin_delete" on public.user_type_assignments;

-- 4. Create explicit RLS policies for public.types
create policy "types_select_all" on public.types
  for select using (true);

create policy "types_admin_insert" on public.types
  for insert with check (public.is_admin());

create policy "types_admin_update" on public.types
  for update using (public.is_admin()) with check (public.is_admin());

create policy "types_admin_delete" on public.types
  for delete using (public.is_admin());

-- 5. Create explicit RLS policies for public.user_type_assignments
create policy "uta_select_all" on public.user_type_assignments
  for select using (true);

create policy "uta_admin_insert" on public.user_type_assignments
  for insert with check (public.is_admin());

create policy "uta_admin_update" on public.user_type_assignments
  for update using (public.is_admin()) with check (public.is_admin());

create policy "uta_admin_delete" on public.user_type_assignments
  for delete using (public.is_admin());

-- 6. Update policies on public.users
drop policy if exists "users_select_all" on public.users;
drop policy if exists "users_admin_write" on public.users;
drop policy if exists "users_admin_insert" on public.users;
drop policy if exists "users_admin_update" on public.users;
drop policy if exists "users_admin_delete" on public.users;

create policy "users_select_all" on public.users
  for select using (true);

create policy "users_admin_insert" on public.users
  for insert with check (public.is_admin());

create policy "users_admin_update" on public.users
  for update
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

create policy "users_admin_delete" on public.users
  for delete using (public.is_admin());
