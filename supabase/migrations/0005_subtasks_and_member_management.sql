-- ============================================================
-- Migration 0005 — Sub-tasks (weighted progress) + PM can manage members
-- Run this in Supabase SQL editor (after 0001, 0002, 0003, 0004)
-- ============================================================

-- ---------------------------------------------------------
-- Sub-tasks: a sub-task is just a task with a parent_task_id.
-- Limited to 1 level deep by application logic (the UI only
-- offers "Add Sub-task" on top-level tasks, never on a
-- sub-task itself) — the column itself doesn't enforce depth,
-- so this is a convention, not a hard DB constraint.
-- ---------------------------------------------------------
alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade,
  add column if not exists weight numeric not null default 1 check (weight > 0);

create index if not exists idx_tasks_parent_task_id on public.tasks(parent_task_id);

-- ---------------------------------------------------------
-- Weighted rollup: if a task has sub-tasks, its progress_percent
-- is always the weighted average of its sub-tasks' progress —
-- manual edits are silently overridden, the same "calculated
-- wins" rule used for projects.progress_calculated in 0001/0002.
-- ---------------------------------------------------------
create or replace function public.calc_weighted_subtask_progress(p_task_id uuid)
returns numeric as $$
  select coalesce(
    round(sum(progress_percent * weight) / nullif(sum(weight), 0), 1),
    0
  )
  from public.tasks
  where parent_task_id = p_task_id;
$$ language sql stable;

create or replace function public.enforce_parent_task_progress()
returns trigger as $$
begin
  if exists (select 1 from public.tasks where parent_task_id = new.id) then
    new.progress_percent := public.calc_weighted_subtask_progress(new.id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_parent_task_progress on public.tasks;
create trigger trg_enforce_parent_task_progress
  before insert or update on public.tasks
  for each row execute procedure public.enforce_parent_task_progress();

-- Whenever a sub-task changes, force-recompute its parent so the
-- rollup stays in sync (the trigger above does the actual math).
create or replace function public.notify_parent_task_on_subtask_change()
returns trigger as $$
declare
  target_parent_id uuid;
begin
  target_parent_id := coalesce(new.parent_task_id, old.parent_task_id);
  if target_parent_id is not null then
    update public.tasks set updated_at = now() where id = target_parent_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_parent_on_subtask_change on public.tasks;
drop trigger if exists trg_notify_parent_on_subtask_iu on public.tasks;
create trigger trg_notify_parent_on_subtask_iu
  after insert or update on public.tasks
  for each row
  when (new.parent_task_id is not null)
  execute procedure public.notify_parent_task_on_subtask_change();

drop trigger if exists trg_notify_parent_on_subtask_delete on public.tasks;
create trigger trg_notify_parent_on_subtask_delete
  after delete on public.tasks
  for each row
  when (old.parent_task_id is not null)
  execute procedure public.notify_parent_task_on_subtask_change();

-- ---------------------------------------------------------
-- Project progress must roll up from TOP-LEVEL tasks only —
-- otherwise sub-tasks would be counted twice (once directly,
-- once already folded into their parent's progress).
-- ---------------------------------------------------------
create or replace function public.recalc_project_progress()
returns trigger as $$
declare
  target_project_id uuid;
  avg_progress numeric;
begin
  target_project_id := coalesce(new.project_id, old.project_id);
  select coalesce(avg(progress_percent), 0) into avg_progress
  from public.tasks
  where project_id = target_project_id and parent_task_id is null;

  update public.projects
  set progress_calculated = round(avg_progress, 1), updated_at = now()
  where id = target_project_id;

  return null;
end;
$$ language plpgsql security definer;
-- (trigger trg_recalc_progress already points at this function — no need to recreate it)

-- ---------------------------------------------------------
-- Let the project's PM manage project_members too, not just Admin
-- (previously only Admin could add/remove people from a project).
-- ---------------------------------------------------------
drop policy if exists "members_admin_write" on public.project_members;
drop policy if exists "members_write" on public.project_members;

create policy "members_write" on public.project_members for all
  using (public.is_admin() or public.is_project_pm(project_id))
  with check (public.is_admin() or public.is_project_pm(project_id));
