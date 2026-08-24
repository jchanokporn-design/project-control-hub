import { createClient } from "@/lib/supabase/server";
import { TypesManager } from "@/components/admin/types-manager";

export default async function AdminTypesPage() {
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("types")
    .select("id, name, code_prefix, is_active, created_at")
    .order("created_at", { ascending: true });

  // Usage counts so the UI can block deleting a Type that's still
  // referenced by projects, templates, or users — this is a safer
  // guard than relying only on the FK constraint's error message.
  const [{ data: projectUses }, { data: templateUses }, { data: userUses }] = await Promise.all([
    supabase.from("projects").select("type_id"),
    supabase.from("project_templates").select("type_id"),
    supabase.from("user_type_assignments").select("type_id"),
  ]);

  function countBy(rows: { type_id: string }[] | null) {
    const m: Record<string, number> = {};
    (rows ?? []).forEach((r) => (m[r.type_id] = (m[r.type_id] ?? 0) + 1));
    return m;
  }

  const usage = {
    projects: countBy(projectUses),
    templates: countBy(templateUses),
    users: countBy(userUses),
  };

  return <TypesManager initialTypes={types ?? []} usage={usage} />;
}
