"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  currentUserId,
  initialUsers,
  types,
  initialAssignments,
}: {
  currentUserId: string;
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

  // Modal State for Add User
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [newCode, setNewCode] = useState("");
  const [newTypeIds, setNewTypeIds] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);

  function typesOf(userId: string) {
    const typeIds = assignments.filter((a) => a.user_id === userId).map((a) => a.type_id);
    return types.filter((t) => typeIds.includes(t.id));
  }

  async function toggleActive(u: UserRow) {
    if (u.id === currentUserId) {
      alert("คุณไม่สามารถปิดการใช้งานบัญชีของตนเองได้ เพื่อป้องกันการถูกล็อกออกจากระบบ (Self-Lockout)");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const nextStatus = !u.is_active;

    // Use .select() to verify that Database actually committed the update
    const { data, error } = await supabase
      .from("users")
      .update({ is_active: nextStatus })
      .eq("id", u.id)
      .select();

    if (error) {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    } else if (!data || data.length === 0) {
      alert("ไม่สามารถบันทึกลงฐานข้อมูลได้: สิทธิ์ RLS บล็อกคำสั่งนี้ กรุณาตรวจสอบสิทธิ์ Admin หรือรัน Migration 0008");
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: nextStatus } : x)));
      router.refresh();
    }
    setSaving(false);
  }

  async function changeRole(u: UserRow, role: "admin" | "member") {
    if (u.id === currentUserId && role !== "admin") {
      if (!confirm("คุณกำลังจะลดสิทธิ์ของตนเองจาก Admin เป็น Member คุณแน่ใจหรือไม่?")) {
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", u.id)
      .select();

    if (error) {
      alert("แก้ไขไม่สำเร็จ: " + error.message);
    } else if (!data || data.length === 0) {
      alert("ไม่สามารถบันทึกลงฐานข้อมูลได้: กรุณาตรวจสอบสิทธิ์ Admin หรือรัน Migration 0008");
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      router.refresh();
    }
    setSaving(false);
  }

  function startEditCode(u: UserRow) {
    setEditingCodeFor(u.id);
    setCodeDraft(u.employee_code ?? "");
    setCodeError(null);
  }

  async function saveCode(u: UserRow) {
    const trimmed = codeDraft.trim().toUpperCase();
    if (trimmed && !EMPLOYEE_CODE_PATTERN.test(trimmed)) {
      setCodeError("ใช้ได้เฉพาะตัวอักษร A-Z, ตัวเลข และขีดกลาง (-) ไม่เกิน 10 ตัวอักษร");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ employee_code: trimmed || null })
      .eq("id", u.id)
      .select();

    if (error) {
      setCodeError(error.message.includes("duplicate") ? "รหัสนี้ถูกใช้แล้ว" : error.message);
    } else if (!data || data.length === 0) {
      setCodeError("ไม่สามารถบันทึกได้: ติดสิทธิ์ RLS");
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, employee_code: trimmed || null } : x)));
      setEditingCodeFor(null);
      router.refresh();
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
        alert("แก้ไขไม่สำเร็จ: " + error.message + " (กรุณารัน Migration 0008 ใน Supabase เพื่อเปิดสิทธิ์การบันทึก)");
      }
    }
    setSaving(false);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    setAddError(null);

    const trimmedCode = newCode.trim().toUpperCase();
    if (trimmedCode && !EMPLOYEE_CODE_PATTERN.test(trimmedCode)) {
      setAddError("รหัสผู้ใช้ต้องเป็นตัวอักษร A-Z, 0-9 หรือขีดกลาง (-) สูงสุด 10 ตัว");
      setAddingUser(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
          employee_code: trimmedCode || null,
          type_ids: newTypeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "เกิดข้อผิดพลาดในการสร้างผู้ใช้");
      } else {
        alert("สร้างผู้ใช้สำเร็จ!");
        setShowAddModal(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewCode("");
        setNewTypeIds([]);
        router.refresh();
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "การเชื่อมต่อล้มเหลว");
    } finally {
      setAddingUser(false);
    }
  }

  function toggleNewUserType(typeId: string) {
    setNewTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">จัดการผู้ใช้งาน (Users Management)</h2>
          <p className="text-xs text-slate-500">กำหนดสิทธิ์ Role, Tag Types และเปิด/ปิดการใช้งานผู้ใช้ในระบบ</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 text-xs">
          <span>+</span> เพิ่มผู้ใช้ใหม่ (Add User)
        </Button>
      </div>

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
                <tr className={`border-t border-slate-100 align-top ${!u.is_active ? "bg-slate-50/60" : ""}`}>
                  <td className="px-4 py-2.5">
                    {editingCodeFor === u.id ? (
                      <div>
                        <Input
                          value={codeDraft}
                          onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                          maxLength={10}
                          className="w-28 text-xs font-mono"
                          placeholder="เช่น EMP-001"
                          autoFocus
                        />
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveCode(u)}
                            disabled={saving}
                            className="text-[11px] font-medium text-slate-700 hover:underline"
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
                        {codeError && <p className="mt-1 w-40 text-[10px] text-rose-600">{codeError}</p>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditCode(u)}
                        className="font-mono text-xs text-slate-600 hover:text-slate-900 hover:underline"
                        title="คลิกเพื่อแก้ไข ID"
                      >
                        {u.employee_code ?? <span className="italic text-slate-300">-- ระบุ --</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">
                      {u.name} {u.id === currentUserId && <span className="text-[10px] text-blue-600 font-normal">(คุณ)</span>}
                    </p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      disabled={saving}
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as "admin" | "member")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
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
                        className="ml-1 text-xs text-slate-500 hover:text-slate-800 hover:underline"
                      >
                        {editingTypesFor === u.id ? "ปิด" : "แก้ไข"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={saving || (u.id === currentUserId && u.is_active)}
                      onClick={() => toggleActive(u)}
                      title={u.id === currentUserId ? "ไม่สามารถปิดใช้งานบัญชีตนเองได้" : ""}
                      className={`text-xs font-medium ${
                        u.id === currentUserId && u.is_active
                          ? "cursor-not-allowed text-slate-300"
                          : u.is_active
                          ? "text-rose-600 hover:text-rose-800"
                          : "text-emerald-600 hover:text-emerald-800"
                      }`}
                    >
                      {u.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </td>
                </tr>
                {editingTypesFor === u.id && (
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <p className="mb-2 text-xs font-medium text-slate-700">เลือก Type ที่ผูกกับ {u.name}</p>
                      <div className="flex flex-wrap gap-3">
                        {types.map((t) => {
                          const assigned = assignments.some((a) => a.user_id === u.id && a.type_id === t.id);
                          return (
                            <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                disabled={saving}
                                checked={assigned}
                                onChange={() => toggleType(u.id, t.id, assigned)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              {t.name}
                            </label>
                          );
                        })}
                        {types.length === 0 && (
                          <p className="text-xs text-slate-400">
                            ยังไม่มี Type ในระบบ — สามารถไปเพิ่มที่แท็บ Types ก่อนได้ครับ
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
                  ยังไม่มีผู้ใช้ในระบบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal Add New User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">เพิ่มผู้ใช้ใหม่ (Add New User)</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 flex flex-col gap-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  อีเมล (Email สำหรับเข้าสู่ระบบ) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  รหัสผ่านเริ่มต้น (Temporary Password) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">รหัสพนักงาน (ID)</label>
                  <Input
                    maxLength={10}
                    placeholder="เช่น IT-001"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">ระดับสิทธิ์ (Role)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "member" | "admin")}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">กำหนด Type ให้ผู้ใช้</label>
                <div className="flex flex-wrap gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  {types.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={newTypeIds.includes(t.id)}
                        onChange={() => toggleNewUserType(t.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {t.name}
                    </label>
                  ))}
                  {types.length === 0 && (
                    <span className="text-xs text-slate-400">ยังไม่มี Type ให้เลือก</span>
                  )}
                </div>
              </div>

              {addError && (
                <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {addError}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingUser}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={addingUser}>
                  {addingUser ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
