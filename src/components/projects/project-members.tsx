"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  roleInProject: "pm" | "member" | "viewer";
}
interface UserOption {
  id: string;
  name: string;
  email: string;
}

const ROLE_LABEL: Record<Member["roleInProject"], string> = {
  pm: "PM",
  member: "Member",
  viewer: "Viewer",
};
const ROLE_TONE: Record<Member["roleInProject"], "blue" | "gray" | "green"> = {
  pm: "blue",
  member: "gray",
  viewer: "green",
};

export function ProjectMembers({
  projectId,
  initialMembers,
  allUsers,
  canManage,
}: {
  projectId: string;
  initialMembers: Member[];
  allUsers: UserOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showAdd, setShowAdd] = useState(false);
  const [pickUserId, setPickUserId] = useState("");
  const [pickRole, setPickRole] = useState<Member["roleInProject"]>("member");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const availableUsers = allUsers.filter((u) => !members.some((m) => m.userId === u.id));
  const pmCount = members.filter((m) => m.roleInProject === "pm").length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!pickUserId) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: pickUserId, role_in_project: pickRole })
      .select("id, user_id, role_in_project, users ( name, email )")
      .single();

    if (!error && data) {
      const u = Array.isArray(data.users) ? data.users[0] : data.users;
      setMembers((prev) => [
        ...prev,
        { membershipId: data.id, userId: data.user_id, roleInProject: data.role_in_project, name: u?.name ?? "", email: u?.email ?? "" },
      ]);
      setPickUserId("");
      setPickRole("member");
      setShowAdd(false);
      router.refresh();
    } else if (error) {
      alert("เพิ่มสมาชิกไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleRemove(m: Member) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("project_members").delete().eq("id", m.membershipId);
    if (!error) {
      setMembers((prev) => prev.filter((x) => x.membershipId !== m.membershipId));
      setConfirmRemove(null);
      router.refresh();
    } else {
      alert("ลบสมาชิกไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleRoleChange(m: Member, role: Member["roleInProject"]) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("project_members")
      .update({ role_in_project: role })
      .eq("id", m.membershipId);
    if (!error) {
      setMembers((prev) => prev.map((x) => (x.membershipId === m.membershipId ? { ...x, roleInProject: role } : x)));
      router.refresh();
    } else {
      alert("แก้ไข role ไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">สมาชิกโครงการ</p>
        {canManage && !showAdd && (
          <button type="button" onClick={() => setShowAdd(true)} className="text-xs text-slate-500 hover:text-slate-800">
            + เพิ่มสมาชิก
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {members.map((m) => (
          <div key={m.membershipId} className="flex items-center justify-between rounded-md px-1 py-1 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{m.name || m.email}</p>
              <p className="truncate text-xs text-slate-400">{m.email}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {canManage ? (
                <select
                  disabled={saving}
                  value={m.roleInProject}
                  onChange={(e) => handleRoleChange(m, e.target.value as Member["roleInProject"])}
                  className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs"
                >
                  <option value="pm">PM</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <Badge tone={ROLE_TONE[m.roleInProject]}>{ROLE_LABEL[m.roleInProject]}</Badge>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(m)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  ลบ
                </button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && <p className="text-xs text-slate-400">ยังไม่มีสมาชิก</p>}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">ผู้ใช้</label>
            <select
              required
              value={pickUserId}
              onChange={(e) => setPickUserId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">-- เลือกผู้ใช้ --</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
            <select
              value={pickRole}
              onChange={(e) => setPickRole(e.target.value as Member["roleInProject"])}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="pm">PM</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              เพิ่ม
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">ยืนยันการลบสมาชิก</h3>
            <p className="mb-4 text-sm text-slate-600">
              ต้องการลบ &ldquo;{confirmRemove.name || confirmRemove.email}&rdquo; ออกจากโครงการนี้ใช่หรือไม่?
              {confirmRemove.roleInProject === "pm" && pmCount <= 1 && (
                <span className="mt-2 block font-medium text-amber-600">
                  ⚠ นี่คือ PM คนสุดท้ายของโครงการ — หลังลบจะไม่มีใครมีสิทธิ์ PM ในโครงการนี้
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmRemove(null)}>
                ยกเลิก
              </Button>
              <Button type="button" variant="danger" disabled={saving} onClick={() => handleRemove(confirmRemove)}>
                ลบสมาชิก
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
