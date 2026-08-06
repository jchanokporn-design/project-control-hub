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

  const { data: templates } = await supabase
    .from("project_templates")
    .select("id, name, type")
    .order("name");

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">New Project</h1>
      <NewProjectForm templates={templates ?? []} users={users ?? []} />
    </div>
  );
}
