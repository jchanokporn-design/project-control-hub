"use client";

import { useMemo, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, TASK_STATUS_TONE, TASK_STATUS_LABEL } from "@/components/ui/badge";
import type { Task, TaskStatus } from "@/lib/supabase/types";

interface Member {
  id: string;
  name: string;
  email: string;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

// Order used when sorting by Status, so it reads as a natural workflow
// progression rather than alphabetically.
const STATUS_SORT_ORDER: Record<TaskStatus, number> = {
  not_started: 0,
  in_progress: 1,
  blocked: 2,
  completed: 3,
  cancelled: 4,
};

// Sub-tasks with more than this many siblings get a soft nudge to split the
// parent task up (based on the 8/80 rule) — never blocks saving.
const SUBTASK_SOFT_WARNING = 15;

type SortKey = "start_date" | "due_date" | "status" | "progress_percent";
type SortDir = "asc" | "desc";

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-slate-800">
        {label} {active ? <span className="text-slate-700">{dir === "asc" ? "▲" : "▼"}</span> : <span className="text-slate-300">↕</span>}
      </button>
    </th>
  );
}

export function TaskList({
  projectId,
  initialTasks,
  members,
  currentUserId,
  canManage,
  canDelete,
}: {
  projectId: string;
  initialTasks: Task[];
  members: Member[];
  currentUserId: string;
  canManage: boolean; // Admin or PM of this project — can add/reassign tasks
  canDelete: boolean; // Admin only — matches the tasks_delete RLS policy
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  // router.refresh() re-fetches server data and passes a new `initialTasks`
  // prop down, but useState only reads its initial value once on mount —
  // without reconciling here, values that only change via DB triggers (like
  // a parent task's auto-rolled-up progress from its sub-tasks) never show
  // up in the UI until a full page reload. This is React's recommended
  // "adjust state during render" pattern rather than a useEffect, since it
  // avoids an extra render pass.
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskRemark, setNewTaskRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState("");
  const [editWeight, setEditWeight] = useState("1");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sub-task add form (1 level deep only — the "+ Sub-task" action never
  // appears on a row that is itself already a sub-task).
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubAssignee, setNewSubAssignee] = useState("");
  const [newSubStart, setNewSubStart] = useState("");
  const [newSubDue, setNewSubDue] = useState("");
  const [newSubWeight, setNewSubWeight] = useState("1");

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  function childrenOf(taskId: string) {
    return tasks.filter((t) => t.parent_task_id === taskId);
  }
  function hasChildren(taskId: string) {
    return tasks.some((t) => t.parent_task_id === taskId);
  }

  function canEditTask(task: Task) {
    return canManage || task.assignee_id === currentUserId;
  }

  async function updateTask(taskId: string, patch: Partial<Task>) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      router.refresh();
    } else {
      alert("บันทึกไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        name: newTaskName,
        assignee_id: newTaskAssignee || null,
        start_date: newTaskStart || null,
        due_date: newTaskDue || null,
        remark: newTaskRemark || null,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [...prev, data]);
      setNewTaskName("");
      setNewTaskAssignee("");
      setNewTaskStart("");
      setNewTaskDue("");
      setNewTaskRemark("");
      setShowAddForm(false);
      router.refresh();
    } else if (error) {
      alert("สร้าง Task ไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleAddSubtask(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentId,
        name: newSubName,
        assignee_id: newSubAssignee || null,
        start_date: newSubStart || null,
        due_date: newSubDue || null,
        weight: Number(newSubWeight) || 1,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [...prev, data]);
      setNewSubName("");
      setNewSubAssignee("");
      setNewSubStart("");
      setNewSubDue("");
      setNewSubWeight("1");
      setAddingSubtaskFor(null);
      router.refresh(); // parent's rolled-up progress changed too
    } else if (error) {
      alert("สร้าง Sub-task ไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function handleDeleteTask(taskId: string) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId && t.parent_task_id !== taskId));
      setConfirmDeleteId(null);
      router.refresh();
    } else {
      alert("ลบ Task ไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Sort applies to top-level tasks only; each task's sub-tasks stay grouped
  // directly beneath it (in creation order) so the hierarchy never breaks.
  const displayRows = useMemo(() => {
    const topLevel = tasks.filter((t) => !t.parent_task_id);
    const sortedTop = (() => {
      if (!sortKey) return topLevel;
      const dir = sortDir === "asc" ? 1 : -1;
      return [...topLevel].sort((a, b) => {
        let av: number, bv: number;
        if (sortKey === "start_date") {
          av = a.start_date ? new Date(a.start_date).getTime() : Infinity;
          bv = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        } else if (sortKey === "due_date") {
          av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        } else if (sortKey === "status") {
          av = STATUS_SORT_ORDER[a.status];
          bv = STATUS_SORT_ORDER[b.status];
        } else {
          av = a.progress_percent;
          bv = b.progress_percent;
        }
        return (av - bv) * dir;
      });
    })();

    const rows: { task: Task; isSub: boolean }[] = [];
    sortedTop.forEach((t) => {
      rows.push({ task: t, isSub: false });
      childrenOf(t.id).forEach((c) => rows.push({ task: c, isSub: true }));
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sortKey, sortDir]);

  const editingTask = tasks.find((t) => t.id === editingTaskId) ?? null;

  function openEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditRemark(task.remark ?? "");
    setEditWeight(String(task.weight ?? 1));
  }

  async function saveRemark() {
    if (!editingTaskId || !editingTask) return;
    const patch: Partial<Task> = { remark: editRemark || null };
    // Weight only matters for sub-tasks (it's what feeds the parent's
    // weighted-average rollup) — only send it if this row is a sub-task.
    if (editingTask.parent_task_id) {
      patch.weight = Number(editWeight) || 1;
    }
    await updateTask(editingTaskId, patch);
    setEditingTaskId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Assignee</th>
              <SortTh label="Start" active={sortKey === "start_date"} dir={sortDir} onClick={() => toggleSort("start_date")} />
              <SortTh label="Due" active={sortKey === "due_date"} dir={sortDir} onClick={() => toggleSort("due_date")} />
              <SortTh label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
              <SortTh label="Progress" active={sortKey === "progress_percent"} dir={sortDir} onClick={() => toggleSort("progress_percent")} />
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ task, isSub }) => {
              const editable = canEditTask(task);
              const locked = hasChildren(task.id); // progress rolls up automatically
              const subCount = isSub ? 0 : childrenOf(task.id).length;
              return (
                <Fragment key={task.id}>
                  <tr key={task.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <div className={isSub ? "flex items-center gap-1.5 pl-5" : ""}>
                        {isSub && <span className="text-slate-300">↳</span>}
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className={`text-left hover:underline ${isSub ? "text-slate-600" : "font-medium text-slate-800"}`}
                          title="แก้ไขรายละเอียด Task"
                        >
                          {task.name}
                        </button>
                        {isSub && task.weight !== 1 && (
                          <span className="text-[10px] text-slate-400" title="Weight">
                            (weight {task.weight})
                          </span>
                        )}
                        {task.is_milestone && (
                          <Badge tone="blue" className="ml-1">
                            Milestone
                          </Badge>
                        )}
                      </div>
                      {task.remark && (
                        <p className={`mt-0.5 line-clamp-1 text-xs text-slate-400 ${isSub ? "pl-5" : ""}`}>{task.remark}</p>
                      )}
                      {subCount > SUBTASK_SOFT_WARNING && (
                        <p className="mt-0.5 text-xs text-amber-600">
                          ⚠ Task นี้มี Sub-task เยอะ ({subCount} ข้อ) ควรพิจารณาแตกเป็นหลาย Task แทน
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {canManage ? (
                        <select
                          disabled={saving}
                          value={task.assignee_id ?? ""}
                          onChange={(e) => updateTask(task.id, { assignee_id: e.target.value || null })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">-- ไม่ระบุ --</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{task.assignee_id ? memberById[task.assignee_id]?.name ?? "—" : "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {editable ? (
                        <input
                          disabled={saving}
                          type="date"
                          value={task.start_date ?? ""}
                          onChange={(e) => updateTask(task.id, { start_date: e.target.value || null })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        <span>{task.start_date ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {editable ? (
                        <input
                          disabled={saving}
                          type="date"
                          value={task.due_date ?? ""}
                          onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        <span>{task.due_date ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <select
                          disabled={saving}
                          value={task.status}
                          onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {locked ? (
                        <span className="text-slate-500" title="คำนวณอัตโนมัติจากค่าเฉลี่ยถ่วงน้ำหนักของ Sub-task">
                          {task.progress_percent}%{" "}
                          <span className="text-[10px] text-slate-400">(auto)</span>
                        </span>
                      ) : editable ? (
                        <input
                          disabled={saving}
                          type="number"
                          min={0}
                          max={100}
                          value={task.progress_percent}
                          onChange={(e) => updateTask(task.id, { progress_percent: Number(e.target.value) })}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        <span>{task.progress_percent}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {canManage && !isSub && (
                          <button
                            type="button"
                            onClick={() => setAddingSubtaskFor(addingSubtaskFor === task.id ? null : task.id)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                            title="เพิ่ม Sub-task"
                          >
                            + Sub-task
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="text-xs text-slate-500 hover:text-slate-800"
                          title="แก้ไข"
                        >
                          แก้ไข
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(task.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                            title="ลบ Task"
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {addingSubtaskFor === task.id && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={7} className="px-3 py-3">
                        <form
                          onSubmit={(e) => handleAddSubtask(e, task.id)}
                          className="flex flex-wrap items-end gap-2 pl-5"
                        >
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Sub-task name</label>
                            <Input
                              required
                              value={newSubName}
                              onChange={(e) => setNewSubName(e.target.value)}
                              className="w-48"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Assignee</label>
                            <select
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={newSubAssignee}
                              onChange={(e) => setNewSubAssignee(e.target.value)}
                            >
                              <option value="">-- ไม่ระบุ --</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Start date</label>
                            <Input type="date" value={newSubStart} onChange={(e) => setNewSubStart(e.target.value)} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Due date</label>
                            <Input type="date" value={newSubDue} onChange={(e) => setNewSubDue(e.target.value)} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Weight <span className="text-slate-400">(ค่าเริ่มต้น 1)</span>
                            </label>
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={newSubWeight}
                              onChange={(e) => setNewSubWeight(e.target.value)}
                              className="w-20"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                              Save
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setAddingSubtaskFor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  ยังไม่มี Task
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div>
          {!showAddForm ? (
            <Button variant="secondary" onClick={() => setShowAddForm(true)}>
              + Add Task
            </Button>
          ) : (
            <form
              onSubmit={handleAddTask}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Task name</label>
                  <Input
                    required
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Assignee</label>
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Start date</label>
                  <Input
                    type="date"
                    value={newTaskStart}
                    onChange={(e) => setNewTaskStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Due date</label>
                  <Input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Description (ไม่บังคับ)
                </label>
                <textarea
                  value={newTaskRemark}
                  onChange={(e) => setNewTaskRemark(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Edit Task modal — description/remark editing, opened by clicking the task name or "แก้ไข" */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="mb-1 text-sm font-semibold text-slate-900">แก้ไข Task</h3>
            <p className="mb-3 text-xs text-slate-500">{editingTask.name}</p>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={editRemark}
              onChange={(e) => setEditRemark(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="รายละเอียดงาน / หมายเหตุ"
            />
            {editingTask.parent_task_id && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Weight <span className="text-slate-400">(น้ำหนักถ่วง เทียบกับ Sub-task พี่น้อง — ค่ามาก = มีผลต่อ % ของ Task แม่มากกว่า)</span>
                </label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-24"
                />
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteId(editingTask.id);
                    setEditingTaskId(null);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  ลบ Task นี้
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditingTaskId(null)}>
                  ยกเลิก
                </Button>
                <Button type="button" onClick={saveRemark} disabled={saving}>
                  บันทึก
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">ยืนยันการลบ Task</h3>
            <p className="mb-4 text-sm text-slate-600">
              ต้องการลบ &ldquo;{tasks.find((t) => t.id === confirmDeleteId)?.name}&rdquo; ใช่หรือไม่?
              {hasChildren(confirmDeleteId ?? "") && " Sub-task ทั้งหมดข้างใต้จะถูกลบไปด้วย"}
              การลบนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => handleDeleteTask(confirmDeleteId)}
              >
                ลบ Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
