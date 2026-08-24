import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  // Only Admin can create projects (per requirements doc, section 2).
  if (profile?.role !== "admin") {
    redirect("/projects");
  }

  const { data: types } = await supabase
    .from("types")
    .select("id, name, code_prefix")
    .eq("is_active", true)
    .order("name");

  const { data: templates } = await supabase
    .from("project_templates")
    .select("id, name, type_id")
    .order("name");

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  // For filtering the Project Manager dropdown by matching Type — see the
  // design note in migration 0007 for how Type↔Project-type matching works.
  const { data: typeAssignments } = await supabase
    .from("user_type_assignments")
    .select("user_id, type_id");

  const userTypeMap: Record<string, string[]> = {};
  (typeAssignments ?? []).forEach((a) => {
    (userTypeMap[a.user_id] ??= []).push(a.type_id);
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">New Project</h1>
      <NewProjectForm
        types={types ?? []}
        templates={templates ?? []}
        users={users ?? []}
        userTypeMap={userTypeMap}
      />
    </div>
  );
}
