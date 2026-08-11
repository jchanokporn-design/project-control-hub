-- ============================================================
-- Migration 0004 — tighten project edit permission
-- Run this in Supabase SQL editor (after 0001, 0002, 0003)
-- ============================================================

-- ---------------------------------------------------------
-- Security fix (found while adding the Budget edit UI):
-- the old "projects_update" policy let ANY project member
-- (including plain 'member' role, not just the PM) update a
-- project row directly via the API — e.g. edit Budget, dates,
-- or health — even though the UI only exposed that to
-- Admin/PM. RLS is the real boundary; the UI restriction alone
-- doesn't stop a direct API call. This tightens it to match the
-- documented rule: only Admin or the project's PM may edit.
-- ---------------------------------------------------------
create or replace function public.is_project_pm(pid uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid() and role_in_project = 'pm'
  );
$$ language sql security definer stable;

drop policy if exists "projects_update" on public.projects;

create policy "projects_update" on public.projects for update
  using (public.is_admin() or public.is_project_pm(id))
  with check (public.is_admin() or public.is_project_pm(id));
