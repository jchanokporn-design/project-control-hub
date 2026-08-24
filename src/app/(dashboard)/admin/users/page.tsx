import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "@/components/admin/users-manager";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, employee_code, name, email, role, is_active")
    .order("name");

  const { data: types } = await supabase
    .from("types")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: assignments } = await supabase
    .from("user_type_assignments")
    .select("user_id, type_id");

  return (
    <UsersManager
      initialUsers={users ?? []}
      types={types ?? []}
      initialAssignments={assignments ?? []}
    />
  );
}

