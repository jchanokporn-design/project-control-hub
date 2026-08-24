// Hand-written types matching supabase/migrations/0001_init.sql.
// Once the project is linked to a real Supabase project, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type UserRole = "admin" | "member";
export type ProjectHealth = "on_track" | "at_risk" | "delayed" | "on_hold" | "completed";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type ProjectMemberRole = "pm" | "member" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  employee_code: string | null;
  role: UserRole;
  capacity_hours_per_week: number;
  is_active: boolean;
  created_at: string;
}

// The shared Type Master — drives Project type, Template type, and
// User type tagging. See migration 0007.
export interface AppType {
  id: string;
  name: string;
  code_prefix: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  name: string;
  type_id: string;
  pm_id: string | null;
  sponsor: string | null;
  start_date: string | null;
  end_date: string | null;
  health: ProjectHealth;
  budget_planned: number;
  budget_actual: number;
  progress_manual: number | null;
  progress_calculated: number;
  template_id: string | null;
  custom_fields: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: ProjectMemberRole;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  work_package_id: string | null;
  parent_task_id: string | null;
  weight: number;
  name: string;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  progress_percent: number;
  priority: TaskPriority;
  planned_cost: number;
  actual_cost: number;
  is_milestone: boolean;
  is_payment_milestone: boolean;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  type: string;
}

export interface UserTypeAssignment {
  user_id: string;
  type_id: string;
}

// Minimal Database type so `createBrowserClient<Database>` / `createServerClient<Database>`
// type-check. Extend the `Row`/`Insert`/`Update` shapes as Phase 2+ tables come online.
export interface Database {
  public: {
    Tables: {
      users: { Row: AppUser; Insert: Partial<AppUser>; Update: Partial<AppUser> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      project_members: { Row: ProjectMember; Insert: Partial<ProjectMember>; Update: Partial<ProjectMember> };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
    };
  };
}
