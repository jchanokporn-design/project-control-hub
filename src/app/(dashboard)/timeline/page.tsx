import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortfolioGantt } from "@/components/timeline/portfolio-gantt";

export default async function PortfolioTimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already restricts this to: all projects if admin, or only projects
  // the current user is a member of, otherwise — same rule as /projects.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_code, name, type, health, progress_calculated, start_date, end_date")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const { data: tasks } =
    projectIds.length > 0
      ? await supabase
          .from("tasks")
          .select("id, project_id, name, start_date, due_date, status, is_milestone, is_payment_milestone")
          .in("project_id", projectIds)
      : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Portfolio Timeline</h1>
        <p className="text-sm text-slate-500">มุมมองรวมทุกโครงการ — เลือกโครงการที่ต้องการดูเทียบกันบนแกนเวลาเดียว</p>
      </div>

      <PortfolioGantt projects={projects ?? []} tasks={tasks ?? []} />
    </div>
  );
}
