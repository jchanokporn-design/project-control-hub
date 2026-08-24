import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, PROJECT_HEALTH_TONE, PROJECT_HEALTH_LABEL } from "@/components/ui/badge";

export default async function ProjectsPage() {
  const supabase = await createClient();

  // RLS already restricts this to: all projects if admin, or only projects
  // the current user is a member of, otherwise. No extra filtering needed here.
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, project_code, name, health, progress_calculated, start_date, end_date, types ( name )")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
        <Link href="/projects/new">
          <Button>+ New Project</Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}

      {!error && (projects?.length ?? 0) === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">
          ยังไม่มี Project — กด &ldquo;+ New Project&rdquo; เพื่อเริ่มสร้าง Project แรก
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => {
          const typesField = p.types as unknown as { name: string } | { name: string }[] | null;
          const typeName = Array.isArray(typesField) ? typesField[0]?.name : typesField?.name;
          return (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="text-xs font-mono text-slate-400">{p.project_code}</span>
                <Badge tone={PROJECT_HEALTH_TONE[p.health]}>
                  {PROJECT_HEALTH_LABEL[p.health]}
                </Badge>
              </div>
              <h2 className="mt-1 font-medium text-slate-900">{p.name}</h2>
              <p className="mt-0.5 text-xs uppercase text-slate-400">{typeName ?? "—"}</p>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{p.progress_calculated}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-slate-900"
                    style={{ width: `${p.progress_calculated}%` }}
                  />
                </div>
              </div>
            </Card>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
