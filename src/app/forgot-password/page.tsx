"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-lg font-semibold text-slate-900">ลืมรหัสผ่าน</h1>
          <p className="text-sm text-slate-500">
            กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
          </p>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-sm text-emerald-700">
              ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ {email} แล้ว กรุณาตรวจสอบอีเมล
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              {status === "error" && (
                <p className="text-sm text-red-600">ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง</p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
              </Button>
            </form>
          )}
          <Link href="/login" className="mt-3 block text-center text-sm text-slate-500 hover:text-slate-800">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
