-- ============================================================
-- Project Control Hub — Phase 1 schema
-- Run this in Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- USERS (mirrors auth.users, extended with app-level fields)
-- ---------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  capacity_hours_per_week numeric not null default 40,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a public.users row whenever someone signs up via Supabase Auth
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- PROJECT TEMPLATES
-- ---------------------------------------------------------
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('it', 'construction')),
  default_tasks jsonb not null default '[]', -- [{ name, offset_days_start, offset_days_due, is_milestone }]
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text unique not null,
  name text not null,
  type text not null check (type in ('it', 'construction')),
  pm_id uuid references public.users(id),
  sponsor text,
  start_date date,
  end_date date,
  health text not null default 'on_track'
    check (health in ('on_track', 'at_risk', 'delayed', 'on_hold', 'completed')),
  budget_planned numeric default 0,
  budget_actual numeric default 0,
  progress_manual numeric,             -- optional override note, NOT used for reporting
  progress_calculated numeric default 0, -- always derived from tasks, see trigger below
  template_id uuid references public.project_templates(id),
  custom_fields jsonb not null default '{}', -- e.g. { site, contractor, contract_value }
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- project_code auto-generate: IT-2026-001 / CONSTRUCTION-2026-001
create sequence public.project_code_seq;

create function public.generate_project_code()
returns trigger as $$
declare
  prefix text;
  next_val int;
begin
  prefix := case when new.type = 'it' then 'IT' else 'CON' end;
  next_val := nextval('public.project_code_seq');
  new.project_code := prefix || '-' || extract(year from now()) || '-' || lpad(next_val::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_project_code
  before insert on public.projects
  for each row
  when (new.project_code is null or new.project_code = '')
  execute procedure public.generate_project_code();

-- ---------------------------------------------------------
-- PROJECT MEMBERS (drives per-project permission / RLS)
-- ---------------------------------------------------------
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_in_project text not null default 'member' check (role_in_project in ('pm', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ---------------------------------------------------------
-- WORK PACKAGES (optional grouping above tasks)
-- ---------------------------------------------------------
create table public.work_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sequence int default 0
);

-- ---------------------------------------------------------
-- TASKS
-- ---------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  work_package_id uuid references public.work_packages(id) on delete set null,
  name text not null,
  assignee_id uuid references public.users(id),
  start_date date,
  due_date date,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled')),
  progress_percent numeric not null default 0 check (progress_percent between 0 and 100),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  planned_cost numeric default 0,
  actual_cost numeric default 0,
  is_milestone boolean not null default false,
  is_payment_milestone boolean not null default false,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TASK DEPENDENCIES (schema ready, UI comes in the Gantt phase)
-- ---------------------------------------------------------
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null default 'finish_to_start',
  check (task_id <> depends_on_task_id)
);

-- ---------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ATTACHMENTS (metadata only — files live in Supabase Storage)
-- ---------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project', 'task')),
  entity_id uuid not null,
  file_url text not null,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- STATUS HISTORY (audit trail — populated by triggers below)
-- ---------------------------------------------------------
create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project', 'task')),
  entity_id uuid not null,
  field_changed text not null,
  old_value text,
  new_value text,
  changed_by uuid references public.users(id),
  changed_at timestamptz not null default now()
);

-- Audit trigger for the fields called out in the concerns doc (budget, due_date, assignee, status)
create function public.log_task_changes()
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
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_task_changes
  after update on public.tasks
  for each row execute procedure public.log_task_changes();

create function public.log_project_budget_changes()
returns trigger as $$
begin
  if old.budget_planned is distinct from new.budget_planned then
    insert into public.status_history(entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    values ('project', new.id, 'budget_planned', old.budget_planned::text, new.budget_planned::text, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_project_budget
  after update on public.projects
  for each row execute procedure public.log_project_budget_changes();

-- ---------------------------------------------------------
-- progress_calculated: always derived from tasks, per the
-- "manual vs calculated" rule agreed in the requirements doc
-- ---------------------------------------------------------
create function public.recalc_project_progress()
returns trigger as $$
declare
  target_project_id uuid;
  avg_progress numeric;
begin
  target_project_id := coalesce(new.project_id, old.project_id);
  select coalesce(avg(progress_percent), 0) into avg_progress
  from public.tasks where project_id = target_project_id;

  update public.projects
  set progress_calculated = round(avg_progress, 1), updated_at = now()
  where id = target_project_id;

  return null;
end;
$$ language plpgsql security definer;

create trigger trg_recalc_progress
  after insert or update or delete on public.tasks
  for each row execute procedure public.recalc_project_progress();

-- ---------------------------------------------------------
-- RESOURCE CALENDAR (reserved for the Resource Workload phase)
-- ---------------------------------------------------------
create table public.resource_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  is_leave boolean not null default false,
  is_holiday boolean not null default false,
  available_hours numeric not null default 8,
  unique (user_id, date)
);

-- ---------------------------------------------------------
-- BUDGETS / RISKS / MILESTONES (reserved for later phases)
-- ---------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null,
  planned numeric default 0,
  actual numeric default 0,
  committed numeric default 0,
  forecast numeric default 0
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  severity text check (severity in ('low', 'medium', 'high')),
  status text default 'open',
  mitigation text
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  due_date date,
  status text default 'pending',
  is_payment_milestone boolean not null default false
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.work_packages enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.status_history enable row level security;
alter table public.project_templates enable row level security;

-- Helper: is the current user an admin?
create function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin' and is_active
  );
$$ language sql security definer stable;

-- Helper: is the current user a member of a given project?
create function public.is_project_member(pid uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- USERS: everyone can read active users (needed for assignee pickers); only admin writes
create policy "users_select_all" on public.users for select using (true);
create policy "users_admin_write" on public.users for all using (public.is_admin()) with check (public.is_admin());

-- PROJECT TEMPLATES: readable by everyone logged in, writable by admin
create policy "templates_select" on public.project_templates for select using (true);
create policy "templates_admin_write" on public.project_templates for all using (public.is_admin()) with check (public.is_admin());

-- PROJECTS: admin sees/edits all; member sees only projects they belong to
create policy "projects_select" on public.projects for select
  using (public.is_admin() or public.is_project_member(id));
create policy "projects_admin_write" on public.projects for insert
  with check (public.is_admin());
create policy "projects_update" on public.projects for update
  using (public.is_admin() or public.is_project_member(id))
  with check (public.is_admin() or public.is_project_member(id));
create policy "projects_admin_delete" on public.projects for delete
  using (public.is_admin());

-- PROJECT MEMBERS: visible to project members + admin; only admin/pm manages membership
create policy "members_select" on public.project_members for select
  using (public.is_admin() or public.is_project_member(project_id));
create policy "members_admin_write" on public.project_members for all
  using (public.is_admin()) with check (public.is_admin());

-- WORK PACKAGES / TASKS / DEPENDENCIES / COMMENTS / ATTACHMENTS:
-- readable by project members + admin
create policy "wp_select" on public.work_packages for select
  using (public.is_admin() or public.is_project_member(project_id));
create policy "wp_write" on public.work_packages for all
  using (public.is_admin() or public.is_project_member(project_id))
  with check (public.is_admin() or public.is_project_member(project_id));

create policy "tasks_select" on public.tasks for select
  using (public.is_admin() or public.is_project_member(project_id));
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_admin() or public.is_project_member(project_id));
-- members can only update tasks assigned to them; admin/pm can update any task in their project
create policy "tasks_update" on public.tasks for update
  using (
    public.is_admin()
    or assignee_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_id = tasks.project_id and user_id = auth.uid() and role_in_project = 'pm'
    )
  )
  with check (
    public.is_admin()
    or assignee_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_id = tasks.project_id and user_id = auth.uid() and role_in_project = 'pm'
    )
  );
create policy "tasks_delete" on public.tasks for delete
  using (public.is_admin());

create policy "deps_select" on public.task_dependencies for select
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id)) or public.is_admin());
create policy "deps_write" on public.task_dependencies for all
  using (public.is_admin()) with check (public.is_admin());

create policy "comments_select" on public.comments for select
  using (exists (select 1 from public.tasks t where t.id = task_id and (public.is_project_member(t.project_id) or public.is_admin())));
create policy "comments_insert" on public.comments for insert
  with check (exists (select 1 from public.tasks t where t.id = task_id and (public.is_project_member(t.project_id) or public.is_admin())));

create policy "attachments_select" on public.attachments for select using (true);
create policy "attachments_insert" on public.attachments for insert with check (auth.uid() is not null);

-- STATUS HISTORY: read-only for project members + admin, writes only via trigger (security definer)
create policy "history_select" on public.status_history for select
  using (
    public.is_admin()
    or (entity_type = 'task' and exists (select 1 from public.tasks t where t.id = entity_id and public.is_project_member(t.project_id)))
    or (entity_type = 'project' and public.is_project_member(entity_id))
  );
