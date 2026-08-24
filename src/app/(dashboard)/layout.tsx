import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/projects" className="font-semibold text-slate-900">
              Project Control Hub
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/projects" className="hover:text-slate-900">
                Projects
              </Link>
              <Link href="/timeline" className="hover:text-slate-900">
                Timeline
              </Link>
              <Link href="/my-work" className="hover:text-slate-900">
                My Work
              </Link>
              {profile?.role === "admin" && (
                <Link href="/admin/users" className="hover:text-slate-900">
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {profile?.name ?? user.email}
              {profile?.role === "admin" && (
                <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  ADMIN
                </span>
              )}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
