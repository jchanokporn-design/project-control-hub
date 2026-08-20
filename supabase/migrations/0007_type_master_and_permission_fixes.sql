-- ============================================================
-- Migration 0007 — Shared Type Master, dynamic Project/Template
-- type, Viewer read-only fix, employee_code
-- Run this in Supabase SQL editor (after 0001-0006)
-- ============================================================

-- ---------------------------------------------------------
-- 1. Promote user_types into a general-purpose Type Master.
-- Renaming in Postgres is safe: existing FKs, RLS policies, and
-- indexes automatically follow the table to its new name.
-- ---------------------------------------------------------
alter table public.user_types rename to types;
alter table public.user_type_assignments rename column user_type_id to type_id;

-- code_prefix drives auto-generated project codes (e.g. "IT" in
-- IT-2026-001). Defaults to the first 3 letters of the name,
-- uppercased, but Admin can override it per type.
alter table public.types add column if not exists code_prefix text;
update public.types set code_prefix = upper(left(name, 3)) where code_prefix is null;
alter table public.types alter column code_prefix set not null;

-- ---------------------------------------------------------
-- 2. Give projects and project_templates a type_id FK into the
-- shared Type Master, replacing the old hardcoded
-- check (type in ('it','construction')).
-- ---------------------------------------------------------
alter table public.projects add column if not exists type_id uuid references public.types(id);
alter table public.project_templates add column if not exists type_id uuid references public.types(id);

-- Backfill from the old text column by matching name.
update public.projects p
set type_id = t.id
from public.types t
where p.type_id is null and lower(t.name) = p.type;

update public.project_templates pt
set type_id = t.id
from public.types t
where pt.type_id is null and lower(t.name) = pt.type;

-- Every row must now have resolved to a type — this will fail
-- loudly if any project/template had a type value that doesn't
-- match a row in types (shouldn't happen given the 0006 seed,
-- but better to find out now than silently drop data).
do $$
begin
  if exists (select 1 from public.projects where type_id is null) then
    raise exception 'Some projects could not be matched to a Type — resolve manually before continuing';
  end if;
  if exists (select 1 from public.project_templates where type_id is null) then
    raise exception 'Some project_templates could not be matched to a Type — resolve manually before continuing';
  end if;
end $$;

alter table public.projects alter column type_id set not null;
alter table public.project_templates alter column type_id set not null;

-- Drop the old fixed-choice columns now that type_id is authoritative.
alter table public.projects drop column type;
alter table public.project_templates drop column type;

-- project_templates(name, type) unique constraint from 0002 referenced
-- the dropped `type` column — recreate it against type_id instead.
alter table public.project_templates drop constraint if exists project_templates_name_type_key;
alter table public.project_templates add constraint project_templates_name_type_id_key unique (name, type_id);

-- ---------------------------------------------------------
-- 3. project_code generation now looks up the prefix from the
-- Type Master instead of a hardcoded if/else on 'it'/'construction'.
-- ---------------------------------------------------------
create or replace function public.generate_project_code()
returns trigger as $$
declare
  prefix text;
  next_val int;
begin
  select code_prefix into prefix from public.types where id = new.type_id;
  next_val := nextval('public.project_code_seq');
  new.project_code := coalesce(prefix, 'GEN') || '-' || extract(year from now()) || '-' || lpad(next_val::text, 3, '0');
  return new;
end;
$$ language plpgsql;
-- (trigger trg_project_code already points at this function — no need to recreate it)

-- ---------------------------------------------------------
-- 4. Fix: Viewer wasn't actually read-only. tasks_update allowed
-- anyone who is the task's assignee to edit it, without checking
-- whether their role_in_project for that project was 'viewer'.
-- tasks_insert also let ANY project member (including viewers)
-- create tasks. Both are tightened here.
-- ---------------------------------------------------------
create or replace function public.project_role(pid uuid)
returns text as $$
  select role_in_project from public.project_members
  where project_id = pid and user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_admin() or public.project_role(project_id) = 'pm');

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update
  using (
    public.is_admin()
    or public.project_role(project_id) = 'pm'
    or (assignee_id = auth.uid() and public.project_role(project_id) <> 'viewer')
  )
  with check (
    public.is_admin()
    or public.project_role(project_id) = 'pm'
    or (assignee_id = auth.uid() and public.project_role(project_id) <> 'viewer')
  );

-- ---------------------------------------------------------
-- 5. employee_code — free-form, unique, user-chosen ID.
-- Letters, digits, and hyphens only, max 10 characters.
-- ---------------------------------------------------------
alter table public.users add column if not exists employee_code text unique;
alter table public.users add constraint employee_code_format
  check (employee_code is null or employee_code ~ '^[A-Za-z0-9-]{1,10}$');
