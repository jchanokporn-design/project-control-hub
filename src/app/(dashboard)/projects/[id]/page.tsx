import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge, PROJECT_HEALTH_TONE, PROJECT_HEALTH_LABEL } from "@/components/ui/badge";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { BudgetCard } from "@/components/projects/budget-card";
import { ProjectMembers } from "@/components/projects/project-members";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("*, types ( name )")
    .eq("id", id)
    .single();

  if (error || !project) notFound();

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const { data: members } = await supabase
    .from("project_members")
    .select("id, user_id, role_in_project, users ( id, name, email )")
    .eq("project_id", id);

  const isPm = members?.some((m) => m.user_id === user.id && m.role_in_project === "pm") ?? false;

  const { data: allUsers } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("start_date", { ascending: true, nullsFirst: false });

  const cf = (project.custom_fields ?? {}) as Record<string, unknown>;
  const typeName = Array.isArray(project.types) ? project.types[0]?.name : project.types?.name;
  const isConstruction = typeName?.toLowerCase() === "construction";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-xs font-mono text-slate-400">{project.project_code}</span>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
          <Badge tone={PROJECT_HEALTH_TONE[project.health]}>
            {PROJECT_HEALTH_LABEL[project.health]}
          </Badge>
        </div>
      </div>

      <ProjectTabs projectId={id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Progress (calculated)</p>
          <p className="mt-1 text-2xl font-semibold">{project.progress_calculated}%</p>
        </Card>
        <BudgetCard
          projectId={id}
          budgetPlanned={project.budget_planned}
          budgetActual={project.budget_actual}
          canManage={isAdmin || isPm}
        />
        <Card className="p-4">
          <p className="text-xs text-slate-500">Timeline</p>
          <p className="mt-1 text-sm font-medium">
            {project.start_date ?? "—"} → {project.end_date ?? "—"}
          </p>
        </Card>
      </div>

      {isConstruction && Boolean(cf.site || cf.contractor) && (
        <Card className="p-4 text-sm">
          <p className="mb-2 text-xs font-medium text-slate-500">Construction Details</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cf.site ? <p>Site: {String(cf.site)}</p> : null}
            {cf.contractor ? <p>Contractor: {String(cf.contractor)}</p> : null}
            {cf.contract_value ? (
              <p>Contract Value: {Number(cf.contract_value).toLocaleString()}</p>
            ) : null}
          </div>
        </Card>
      )}

      <ProjectMembers
        projectId={id}
        initialMembers={(members ?? [])
          .map((m) => {
            const u = Array.isArray(m.users) ? m.users[0] : m.users;
            return u
              ? {
                  membershipId: m.id,
                  userId: m.user_id,
                  name: u.name,
                  email: u.email,
                  roleInProject: m.role_in_project as "pm" | "member" | "viewer",
                }
              : null;
          })
          .filter((m): m is NonNullable<typeof m> => !!m)}
        allUsers={allUsers ?? []}
        canManage={isAdmin || isPm}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Tasks</h2>
        <TaskList
          projectId={id}
          initialTasks={tasks ?? []}
          members={(members ?? [])
            // Same array-vs-single-row inference quirk as in my-work/page.tsx —
            // project_members -> users is many-to-one but gets typed as an array.
            .flatMap((m) => (Array.isArray(m.users) ? m.users : [m.users]))
            .filter((u): u is { id: string; name: string; email: string } => !!u)}
          currentUserId={user.id}
          canManage={isAdmin || isPm}
          canDelete={isAdmin}
        />
      </div>
    </div>
  );
}
