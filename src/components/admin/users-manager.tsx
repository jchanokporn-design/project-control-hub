"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UserRow {
  id: string;
  employee_code: string | null;
  name: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
}
interface TypeOption {
  id: string;
  name: string;
  is_active: boolean;
}
interface Assignment {
  user_id: string;
  type_id: string;
}

const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9-]{1,10}$/;

export function UsersManager({
  initialUsers,
  types,
  initialAssignments,
}: {
  initialUsers: UserRow[];
  types: TypeOption[];
  initialAssignments: Assignment[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [editingTypesFor, setEditingTypesFor] = useState<string | null>(null);
  const [editingCodeFor, setEditingCodeFor] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function typesOf(userId: string) {
    const typeIds = assignments.filter((a) => a.user_id === userId).map((a) => a.type_id);
    return types.filter((t) => typeIds.includes(t.id));
  }

  async function toggleActive(u: UserRow) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ is_active: !u.is_active }).eq("id", u.id);
    if (!error) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
      router.refresh();
    } else {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function changeRole(u: UserRow, role: "admin" | "member") {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ role }).eq("id", u.id);
    if (!error) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      router.refresh();
    } else {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  function startEditCode(u: UserRow) {
    setEditingCodeFor(u.id);
    setCodeDraft(u.employee_code ?? "");
    setCodeError(null);
  }

  async function saveCode(u: UserRow) {
    const trimmed = codeDraft.trim();
    if (trimmed && !EMPLOYEE_CODE_PATTERN.test(trimmed)) {
      setCodeError("ใช้ได้แค่ตัวอักษร A-Z, ตัวเลข, และขีดกลาง (-) ไม่เกิน 10 ตัวอักษร");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ employee_code: trimmed || null })
      .eq("id", u.id);
    if (!error) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, employee_code: trimmed || null } : x)));
      setEditingCodeFor(null);
      router.refresh();
    } else {
      setCodeError(error.message.includes("duplicate") ? "รหัสนี้ถูกใช้แล้ว" : error.message);
    }
    setSaving(false);
  }

  async function toggleType(userId: string, typeId: string, currentlyAssigned: boolean) {
    setSaving(true);
    const supabase = createClient();
    if (currentlyAssigned) {
      const { error } = await supabase
        .from("user_type_assignments")
        .delete()
        .eq("user_id", userId)
        .eq("type_id", typeId);
      if (!error) {
        setAssignments((prev) => prev.filter((a) => !(a.user_id === userId && a.type_id === typeId)));
        router.refresh();
      } else {
        alert("แก้ไขไม่สำเร็จ: " + error.message);
      }
    } else {
      const { error } = await supabase
        .from("user_type_assignments")
        .insert({ user_id: userId, type_id: typeId });
      if (!error) {
        setAssignments((prev) => [...prev, { user_id: userId, type_id: typeId }]);
        router.refresh();
      } else {
        alert("แก้ไขไม่สำเร็จ: " + error.message);
      }
    }
    setSaving(false);
  }

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Types</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr className="border-t border-slate-100 align-top">
                <td className="px-4 py-2.5">
                  {editingCodeFor === u.id ? (
                    <div>
                      <Input
                        value={codeDraft}
                        onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="w-28 text-xs"
                        placeholder="เช่น EMP-001"
                        autoFocus
                      />
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveCode(u)}
                          disabled={saving}
                          className="text-[11px] text-slate-700 hover:underline"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCodeFor(null)}
                          className="text-[11px] text-slate-400 hover:underline"
                        >
                          ยกเลิก
                        </button>
                      </div>
                      {codeError && <p className="mt-1 w-40 text-[10px] text-red-600">{codeError}</p>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditCode(u)}
                      className="font-mono text-xs text-slate-600 hover:text-slate-900 hover:underline"
                      title="แก้ไข ID"
                    >
                      {u.employee_code ?? <span className="italic text-slate-300">-- ระบุ --</span>}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    disabled={saving}
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as "admin" | "member")}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {typesOf(u.id).map((t) => (
                      <Badge key={t.id} tone="blue">
                        {t.name}
                      </Badge>
                    ))}
                    {typesOf(u.id).length === 0 && <span className="text-xs text-slate-400">ไม่ระบุ</span>}
                    <button
                      type="button"
                      onClick={() => setEditingTypesFor(editingTypesFor === u.id ? null : u.id)}
                      className="ml-1 text-xs text-slate-400 hover:text-slate-700"
                    >
                      แก้ไข
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleActive(u)}
                    className={
                      u.is_active
                        ? "text-xs text-red-500 hover:text-red-700"
                        : "text-xs text-emerald-600 hover:text-emerald-800"
                    }
                  >
                    {u.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </button>
                </td>
              </tr>
              {editingTypesFor === u.id && (
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td colSpan={6} className="px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-slate-600">เลือก Type ที่เกี่ยวข้องกับ {u.name}</p>
                    <div className="flex flex-wrap gap-3">
                      {types.map((t) => {
                        const assigned = assignments.some((a) => a.user_id === u.id && a.type_id === t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              disabled={saving}
                              checked={assigned}
                              onChange={() => toggleType(u.id, t.id, assigned)}
                            />
                            {t.name}
                          </label>
                        );
                      })}
                      {types.length === 0 && (
                        <p className="text-xs text-slate-400">
                          ยังไม่มี Type ให้เลือก — ไปเพิ่มที่แท็บ Types ก่อน
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                ยังไม่มีผู้ใช้
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
