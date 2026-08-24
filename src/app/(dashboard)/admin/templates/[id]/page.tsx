import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "@/components/admin/template-editor";

interface DefaultTask {
  name: string;
  offset_days_start: number;
  offset_days_due: number;
  is_milestone?: boolean;
}

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("project_templates")
    .select("id, name, type_id, default_tasks")
    .eq("id", id)
    .single();

  if (error || !template) notFound();

  const { data: types } = await supabase
    .from("types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const initialTasks = ((template.default_tasks ?? []) as unknown as DefaultTask[]).map((t) => ({
    key: crypto.randomUUID(),
    name: t.name,
    offset_days_start: t.offset_days_start,
    offset_days_due: t.offset_days_due,
    is_milestone: t.is_milestone ?? false,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-slate-900">Edit Template</p>
      <TemplateEditor
        mode="edit"
        templateId={template.id}
        types={types ?? []}
        initialName={template.name}
        initialTypeId={template.type_id}
        initialTasks={initialTasks}
      />
    </div>
  );
}
