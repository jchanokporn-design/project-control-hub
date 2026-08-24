"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TypeOption {
  id: string;
  name: string;
}
interface TaskRow {
  key: string;
  name: string;
  offset_days_start: number;
  offset_days_due: number;
  is_milestone: boolean;
}

function newRow(): TaskRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    offset_days_start: 0,
    offset_days_due: 0,
    is_milestone: false,
  };
}

export function TemplateEditor({
  mode,
  templateId,
  types,
  initialName,
  initialTypeId,
  initialTasks,
}: {
  mode: "create" | "edit";
  templateId?: string;
  types: TypeOption[];
  initialName?: string;
  initialTypeId?: string;
  initialTasks?: TaskRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [typeId, setTypeId] = useState(initialTypeId ?? types[0]?.id ?? "");
  const [rows, setRows] = useState<TaskRow[]>(
    initialTasks && initialTasks.length > 0 ? initialTasks : [newRow()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<TaskRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function moveRow(key: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ Template");
      return;
    }
    if (!typeId) {
      setError("กรุณาเลือก Type");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const default_tasks = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        offset_days_start: r.offset_days_start,
        offset_days_due: r.offset_days_due,
        is_milestone: r.is_milestone,
      }));

    if (mode === "create") {
      const { error: insertError } = await supabase
        .from("project_templates")
        .insert({ name: name.trim(), type_id: typeId, default_tasks });
      if (insertError) {
        setError(
          insertError.message.includes("duplicate")
            ? "มี Template ชื่อนี้สำหรับ Type นี้อยู่แล้ว"
            : insertError.message
        );
        setSaving(false);
        return;
      }
    } else if (templateId) {
      const { error: updateError } = await supabase
        .from("project_templates")
        .update({ name: name.trim(), type_id: typeId, default_tasks })
        .eq("id", templateId);
      if (updateError) {
        setError(
          updateError.message.includes("duplicate")
            ? "มี Template ชื่อนี้สำหรับ Type นี้อยู่แล้ว"
            : updateError.message
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push("/admin/templates");
    router.refresh();
  }

  async function handleDelete() {
    if (!templateId) return;
    if (!confirm(`ยืนยันลบ Template "${name}" — การลบนี้ย้อนกลับไม่ได้`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("project_templates").delete().eq("id", templateId);
    if (deleteError) {
      alert(
        deleteError.message.includes("foreign key") || deleteError.code === "23503"
          ? "ลบไม่ได้ — มี Project ที่สร้างจาก Template นี้อยู่แล้ว"
          : "ลบไม่สำเร็จ: " + deleteError.message
      );
      setSaving(false);
      return;
    }
    router.push("/admin/templates");
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อ Template</label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">
        Task มาตรฐาน — ตัวเลข offset คือ &ldquo;กี่วันหลังวันเริ่มโครงการ&rdquo; (ระบบจะคำนวณวันที่จริงตอนสร้าง
        Project ที่ใช้ Template นี้)
      </p>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-2">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Task name</label>
              <Input
                value={r.name}
                onChange={(e) => updateRow(r.key, { name: e.target.value })}
                placeholder="เช่น Requirement"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Start (วันที่ +)</label>
              <Input
                type="number"
                className="w-24"
                value={r.offset_days_start}
                onChange={(e) => updateRow(r.key, { offset_days_start: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Due (วันที่ +)</label>
              <Input
                type="number"
                className="w-24"
                value={r.offset_days_due}
                onChange={(e) => updateRow(r.key, { offset_days_due: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-1 pb-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={r.is_milestone}
                onChange={(e) => updateRow(r.key, { is_milestone: e.target.checked })}
              />
              Milestone
            </label>
            <div className="flex gap-1 pb-1">
              <button
                type="button"
                onClick={() => moveRow(r.key, -1)}
                disabled={i === 0}
                className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                title="เลื่อนขึ้น"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveRow(r.key, 1)}
                disabled={i === rows.length - 1}
                className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                title="เลื่อนลง"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                className="rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50"
                title="ลบแถวนี้"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addRow} className="mt-2">
        + Add Task
      </Button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        {mode === "edit" ? (
          <button type="button" onClick={handleDelete} disabled={saving} className="text-xs text-red-500 hover:text-red-700">
            ลบ Template นี้
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/admin/templates")}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
