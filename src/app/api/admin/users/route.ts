import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // 1. Verify current session is an active admin
    const supabase = await createServerSupabase();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", currentUser.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.is_active) {
      return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มผู้ใช้ได้" }, { status: 403 });
    }

    // 2. Parse request payload
    const body = await request.json();
    const { email, password, name, role = "member", employee_code = null, type_ids = [] } = body;

    if (!email || !name || !password) {
      return NextResponse.json({ error: "กรุณากรอก Email, Password และชื่อผู้ใช้ให้ครบถ้วน" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        {
          error:
            "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local หรือ Vercel (คัดลอกได้จาก Supabase Dashboard → Settings → API → service_role)",
          needConfig: true,
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Create user in Supabase Auth
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message || "ไม่สามารถสร้างผู้ใช้ในระบบ Auth ได้" },
        { status: 400 }
      );
    }

    const newUserId = authUser.user.id;

    // 4. Update profile in public.users
    const { error: userUpdateError } = await adminClient
      .from("users")
      .update({
        name,
        role: role === "admin" ? "admin" : "member",
        employee_code: employee_code ? String(employee_code).trim().toUpperCase() : null,
        is_active: true,
      })
      .eq("id", newUserId);

    if (userUpdateError) {
      console.error("Error updating public.users:", userUpdateError);
    }

    // 5. Assign Types (if any)
    if (Array.isArray(type_ids) && type_ids.length > 0) {
      const assignments = type_ids.map((type_id: string) => ({
        user_id: newUserId,
        type_id,
      }));
      await adminClient.from("user_type_assignments").insert(assignments);
    }

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
