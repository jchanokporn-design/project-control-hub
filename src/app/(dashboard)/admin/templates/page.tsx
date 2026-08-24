import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("project_templates")
    .select("id, name, default_tasks, types ( name )")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Template Master</p>
        <Link href="/admin/templates/new">
          <Button>+ New Template</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {(templates ?? []).map((t) => {
          const typeField = t.types as unknown as { name: string } | { name: string }[] | null;
          const typeName = Array.isArray(typeField) ? typeField[0]?.name : typeField?.name;
          const taskCount = Array.isArray(t.default_tasks) ? t.default_tasks.length : 0;
          return (
            <Link key={t.id} href={`/admin/templates/${t.id}`}>
              <Card className="flex items-center justify-between p-4 hover:shadow-md">
                <div>
                  <p className="font-medium text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {typeName ?? "—"} · {taskCount} Task
                  </p>
                </div>
                <span className="text-xs text-slate-400">แก้ไข →</span>
              </Card>
            </Link>
          );
        })}
        {(templates ?? []).length === 0 && (
          <Card className="p-8 text-center text-sm text-slate-400">
            ยังไม่มี Template — กด &ldquo;+ New Template&rdquo; เพื่อสร้างอันแรก
          </Card>
        )}
      </div>
    </div>
  );
}
