import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "@/components/admin/template-editor";

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-slate-900">New Template</p>
      <TemplateEditor mode="create" types={types ?? []} />
    </div>
  );
}
