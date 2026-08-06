import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge, TASK_STATUS_TONE, TASK_STATUS_LABEL } from "@/components/ui/badge";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export default async function MyWorkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, name, due_date, status, progress_percent, project_id, projects ( name, project_code )")
    .eq("assignee_id", user.id)
    .neq("status", "cancelled")
    .order("due_date", { ascending: true, nullsFirst: false });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  type MyTask = NonNullable<typeof tasks>[number];

  const groups: {
    overdue: MyTask[];
    today: MyTask[];
    thisWeek: MyTask[];
    later: MyTask[];
  } = { overdue: [], today: [], thisWeek: [], later: [] };

  (tasks ?? []).forEach((t) => {
    if (!t.due_date) {
      groups.later.push(t);
      return;
    }
    const due = new Date(t.due_date);
    if (due < today) groups.overdue.push(t);
    else if (due.toDateString() === today.toDateString()) groups.today.push(t);
    else if (due <= weekEnd) groups.thisWeek.push(t);
    else groups.later.push(t);
  });

  const sections: { title: string; items: typeof tasks; tone: "red" | "yellow" | "gray" }[] = [
    { title: "Overdue", items: groups.overdue, tone: "red" },
    { title: "Today", items: groups.today, tone: "yellow" },
    { title: "This Week", items: groups.thisWeek, tone: "gray" },
    { title: "Later / No due date", items: groups.later, tone: "gray" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">My Work</h1>

      {sections.map(
        (section) =>
          section.items && section.items.length > 0 && (
            <div key={section.title}>
              <h2 className="mb-2 text-sm font-medium text-slate-500">{section.title}</h2>
              <div className="flex flex-col gap-2">
                {section.items.map((t) => {
                  // Supabase's query builder infers embedded-resource selects as
                  // arrays by default (it can't see the FK cardinality without a
                  // generated Database type), even though task -> project is
                  // many-to-one. Index [0] to get the single related row.
                  const project = Array.isArray(t.projects) ? t.projects[0] : t.projects;
                  return (
                  <Link key={t.id} href={`/projects/${t.project_id}`}>
                    <Card className="flex items-center justify-between p-3 hover:shadow-md">
                      <div>
                        <p className="font-medium text-slate-800">{t.name}</p>
                        <p className="text-xs text-slate-400">
                          {project?.project_code} · {project?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{t.due_date ?? "—"}</span>
                        <Badge tone={TASK_STATUS_TONE[t.status]}>
                          {TASK_STATUS_LABEL[t.status]}
                        </Badge>
                        <span className="text-xs text-slate-500 w-10 text-right">
                          {t.progress_percent}%
                        </span>
                      </div>
                    </Card>
                  </Link>
                  );
                })}
              </div>
            </div>
          )
      )}

      {(tasks?.length ?? 0) === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">
          ยังไม่มี Task ที่มอบหมายให้คุณ
        </Card>
      )}
    </div>
  );
}
