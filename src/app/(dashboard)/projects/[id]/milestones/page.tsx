import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge, PROJECT_HEALTH_TONE, PROJECT_HEALTH_LABEL, TASK_STATUS_TONE, TASK_STATUS_LABEL } from "@/components/ui/badge";
import { ProjectTabs } from "@/components/projects/project-tabs";

export default async function MilestonesPage({
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

  const { data: milestones } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .eq("is_milestone", true)
    .order("due_date", { ascending: true, nullsFirst: false });

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

      {(milestones?.length ?? 0) === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          ยังไม่มี Milestone — ไปที่แท็บ Timeline แล้วติ๊ก &ldquo;ตั้งเป็น Milestone&rdquo; ใน Task ที่ต้องการ
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {milestones!.map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 flex-shrink-0 rotate-45 rounded-sm bg-orange-500"
                  aria-hidden
                />
                <div>
                  <p className="font-medium text-slate-800">
                    {m.name}
                    {m.is_payment_milestone && (
                      <Badge tone="yellow" className="ml-2">
                        Payment
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">Due: {m.due_date ?? "—"}</p>
                </div>
              </div>
              <Badge tone={TASK_STATUS_TONE[m.status]}>{TASK_STATUS_LABEL[m.status]}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
