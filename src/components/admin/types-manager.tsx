"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AppType } from "@/lib/supabase/types";

interface Usage {
  projects: Record<string, number>;
  templates: Record<string, number>;
  users: Record<string, number>;
}

export function TypesManager({ initialTypes, usage }: { initialTypes: AppType[]; usage: Usage }) {
  const router = useRouter();
  const [types, setTypes] = useState<AppType[]>(initialTypes);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrefix, setEditPrefix] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function usageOf(id: string) {
    return (usage.projects[id] ?? 0) + (usage.templates[id] ?? 0) + (usage.users[id] ?? 0);
  }
  function usageLabel(id: string) {
    const parts: string[] = [];
    if (usage.projects[id]) parts.push(`${usage.projects[id]} โครงการ`);
    if (usage.templates[id]) parts.push(`${usage.templates[id]} Template`);
    if (usage.users[id]) parts.push(`${usage.users[id]} ผู้ใช้`);
    return parts.join(", ");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("types")
      .insert({ name: name.trim(), code_prefix: (prefix.trim() || name.trim().slice(0, 3)).toUpperCase() })
      .select()
      .single();

    if (!error && data) {
      setTypes((prev) => [...prev, data]);
      setName("");
      setPrefix("");
      router.refresh();
    } else if (error) {
      setError(error.message.includes("duplicate") ? "มี Type ชื่อนี้อยู่แล้ว" : error.message);
    }
    setSaving(false);
  }

  function startEdit(t: AppType) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditPrefix(t.code_prefix);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("types")
      .update({ name: editName.trim(), code_prefix: editPrefix.trim().toUpperCase() })
      .eq("id", id);
    if (!error) {
      setTypes((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, name: editName.trim(), code_prefix: editPrefix.trim().toUpperCase() } : t
        )
      );
      setEditingId(null);
      router.refresh();
    } else {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function toggleActive(t: AppType) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("types").update({ is_active: !t.is_active }).eq("id", t.id);
    if (!error) {
      setTypes((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: !x.is_active } : x)));
      router.refresh();
    } else {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleDelete(t: AppType) {
    if (usageOf(t.id) > 0) {
      alert(
        `ลบไม่ได้ — Type "${t.name}" ยังถูกใช้งานอยู่ (${usageLabel(t.id)}) กรุณาย้ายไปใช้ Type อื่นก่อน หรือปิดใช้งาน (Inactive) แทนการลบ`
      );
      return;
    }
    if (!confirm(`ยืนยันลบ Type "${t.name}" — การลบนี้ย้อนกลับไม่ได้`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("types").delete().eq("id", t.id);
    if (!error) {
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
      router.refresh();
    } else {
      alert("ลบไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-slate-900">Type Master</p>
        <div className="flex flex-col gap-1.5">
          {types.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md px-1 py-1.5 text-sm">
              {editingId === t.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[160px]" />
                  <Input
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="w-20"
                    placeholder="Prefix"
                  />
                  <Button type="button" onClick={() => saveEdit(t.id)} disabled={saving}>
                    บันทึก
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    ยกเลิก
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{t.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      {t.code_prefix}
                    </span>
                    {t.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                    {usageOf(t.id) > 0 && (
                      <span className="text-[11px] text-slate-400">ใช้อยู่: {usageLabel(t.id)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => startEdit(t)} className="text-xs text-slate-500 hover:text-slate-800">
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleActive(t)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      {t.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDelete(t)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      ลบ
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {types.length === 0 && <p className="text-xs text-slate-400">ยังไม่มี Type</p>}
        </div>

        <form onSubmit={handleAdd} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อ Type ใหม่</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Marketing" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Code Prefix <span className="text-slate-400">(ไม่บังคับ)</span>
            </label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              maxLength={5}
              className="w-24"
              placeholder="เช่น MKT"
            />
          </div>
          <Button type="submit" disabled={saving}>
            เพิ่ม
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </Card>

      <p className="text-xs text-slate-400">
        Type Master นี้ใช้ร่วมกันทั้งระบบ: กำหนด Type ของ Project, กรอง/สร้าง Template Master, และผูกกับ User (Admin →
        Users) — Code Prefix ใช้สร้างรหัสโครงการอัตโนมัติ เช่น Prefix &ldquo;IT&rdquo; → รหัสโครงการ IT-2026-001
      </p>
    </div>
  );
}
