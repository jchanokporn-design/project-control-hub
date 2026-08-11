"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BudgetCard({
  projectId,
  budgetPlanned,
  budgetActual,
  canManage,
}: {
  projectId: string;
  budgetPlanned: number;
  budgetActual: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [planned, setPlanned] = useState(String(budgetPlanned));
  const [actual, setActual] = useState(String(budgetActual));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        budget_planned: Number(planned) || 0,
        budget_actual: Number(actual) || 0,
      })
      .eq("id", projectId);

    setSaving(false);
    if (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <Card
        className={`p-4 ${canManage ? "cursor-pointer hover:shadow-md" : ""}`}
        onClick={() => canManage && setEditing(true)}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Budget Planned / Actual</p>
          {canManage && <span className="text-xs text-slate-400">แก้ไข</span>}
        </div>
        <p className="mt-1 text-lg font-semibold">
          {budgetPlanned.toLocaleString()} / {budgetActual.toLocaleString()}
        </p>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">แก้ไข Budget</h3>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Budget Planned</label>
              <Input
                type="number"
                min="0"
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Budget Actual</label>
              <Input type="number" min="0" value={actual} onChange={(e) => setActual(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                ตอนนี้กรอกยอดรวมด้วยมือ — เมื่อ Phase 4 (Budget Control) เสร็จ ค่านี้จะคำนวณอัตโนมัติจากรายการ
                ค่าใช้จ่ายแยกตามหมวดหมู่แทน
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                บันทึก
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
