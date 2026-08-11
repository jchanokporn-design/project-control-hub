-- ============================================================
-- Migration 0003 — Phase 2 (Timeline & Gantt)
-- Run this in Supabase SQL editor (after 0001 and 0002)
-- ============================================================

-- ---------------------------------------------------------
-- Fix: only Admins could create/edit task dependencies before.
-- Phase 2 needs the project's PM to manage dependencies too,
-- same rule as editing tasks themselves (tasks_update policy).
-- ---------------------------------------------------------
drop policy if exists "deps_write" on public.task_dependencies;

create policy "deps_write" on public.task_dependencies for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id
        and exists (
          select 1 from public.project_members pm
          where pm.project_id = t.project_id and pm.user_id = auth.uid() and pm.role_in_project = 'pm'
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id
        and exists (
          select 1 from public.project_members pm
          where pm.project_id = t.project_id and pm.user_id = auth.uid() and pm.role_in_project = 'pm'
        )
    )
  );

-- ---------------------------------------------------------
-- Security fix (unrelated to Phase 2 features, found while
-- reviewing the schema): the "milestones" table was created
-- back in 0001_init.sql but Row Level Security was never
-- switched on for it, and it had no policies. On Postgres,
-- a table with RLS off falls back to ordinary GRANT-based
-- privileges — and Supabase's default grants would have let
-- ANY logged-in user read and write EVERY project's milestone
-- rows. Phase 2's UI does not use this table yet (milestones
-- are tracked via tasks.is_milestone instead, see README), but
-- closing this gap now is cheap and removes a real exposure.
-- ---------------------------------------------------------
alter table public.milestones enable row level security;

create policy "milestones_select" on public.milestones for select
  using (public.is_admin() or public.is_project_member(project_id));

create policy "milestones_write" on public.milestones for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = milestones.project_id and pm.user_id = auth.uid() and pm.role_in_project = 'pm'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = milestones.project_id and pm.user_id = auth.uid() and pm.role_in_project = 'pm'
    )
  );
