import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/projects");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">จัดการผู้ใช้และ Master Data ของระบบ — Admin เท่านั้น</p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
