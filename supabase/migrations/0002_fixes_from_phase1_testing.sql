-- ============================================================
-- Migration 0002 — fixes based on Phase 1 testing feedback
-- Run this in Supabase SQL editor (after 0001_init.sql)
-- ============================================================

-- ---------------------------------------------------------
-- Fix: projects.progress_calculated could be edited by hand
-- (e.g. via Table Editor or a direct API call), even though
-- the UI never exposed a way to do it. RLS only controls which
-- ROWS a user may update — it does not restrict which COLUMNS,
-- so an Admin/PM who is otherwise allowed to update a project
-- row could still overwrite this column directly.
--
-- Column-level privileges close that gap: this column can now
-- only be written by the trigger function (which runs as
-- SECURITY DEFINER, i.e. with the privileges of its owner, not
-- the calling user), never by an ordinary authenticated request.
-- ---------------------------------------------------------
revoke update (progress_calculated) on public.projects from authenticated;

-- ---------------------------------------------------------
-- Extend the task audit trigger to also log remark/description
-- changes (previously only status, assignee_id, due_date were
-- tracked).
-- ---------------------------------------------------------
create or replace function public.log_task_changes()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into public.status_history(entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    values ('task', new.id, 'status', old.status, new.status, auth.uid());
  end if;
  if old.assignee_id is distinct from new.assignee_id then
    insert into public.status_history(entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    values ('task', new.id, 'assignee_id', old.assignee_id::text, new.assignee_id::text, auth.uid());
  end if;
  if old.due_date is distinct from new.due_date then
    insert into public.status_history(entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    values ('task', new.id, 'due_date', old.due_date::text, new.due_date::text, auth.uid());
  end if;
  if old.remark is distinct from new.remark then
    insert into public.status_history(entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    values ('task', new.id, 'remark', old.remark, new.remark, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer;
-- (trigger trg_log_task_changes already points at this function — no need to recreate it)

-- ---------------------------------------------------------
-- One-off cleanup: de-duplicate project_templates rows created
-- by re-running seed.sql multiple times during setup/testing.
-- Keeps the earliest row per (name, type) pair.
-- ---------------------------------------------------------
delete from public.project_templates a
using public.project_templates b
where a.name = b.name
  and a.type = b.type
  and a.created_at > b.created_at;

-- Prevent this from happening again: seed.sql (updated below) now
-- upserts against this constraint instead of always inserting.
alter table public.project_templates
  add constraint project_templates_name_type_key unique (name, type);
