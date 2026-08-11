import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, PROJECT_HEALTH_TONE, PROJECT_HEALTH_LABEL } from "@/components/ui/badge";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { GanttChart } from "@/components/timeline/gantt-chart";

export default async function TimelinePage({
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

  const { data: project, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error || !project) notFound();

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role_in_project, users ( id, name, email )")
    .eq("project_id", id);

  const isPm = members?.some((m) => m.user_id === user.id && m.role_in_project === "pm") ?? false;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("start_date", { ascending: true, nullsFirst: false });

  const { data: dependencies } = await supabase
    .from("task_dependencies")
    .select("*")
    .in("task_id", (tasks ?? []).map((t) => t.id).length > 0 ? (tasks ?? []).map((t) => t.id) : [
      "00000000-0000-0000-0000-000000000000",
    ]);

  return (
    <div className="flex flex-col gap-4">
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

      <GanttChart
        projectId={id}
        initialTasks={tasks ?? []}
        initialDependencies={dependencies ?? []}
        canManage={isAdmin || isPm}
      />
    </div>
  );
}
