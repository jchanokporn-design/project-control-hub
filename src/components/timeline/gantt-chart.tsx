"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Task, TaskDependency, TaskStatus } from "@/lib/supabase/types";

const BAR_COLOR: Record<TaskStatus, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-200",
};

type Zoom = "day" | "week" | "month";
const PX_PER_DAY: Record<Zoom, number> = { day: 34, week: 13, month: 4.5 };

function toDate(s: string) {
  return new Date(s + "T00:00:00");
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function GanttChart({
  initialTasks,
  initialDependencies,
  canManage,
}: {
  projectId: string;
  initialTasks: Task[];
  initialDependencies: TaskDependency[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dependencies, setDependencies] = useState<TaskDependency[]>(initialDependencies);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dated = tasks.filter((t) => t.start_date && t.due_date);

  const { rangeStart, totalDays, pxPerDay } = useMemo(() => {
    const px = PX_PER_DAY[zoom];
    if (dated.length === 0) {
      const today = new Date();
      return { rangeStart: today, totalDays: 30, pxPerDay: px };
    }
    const starts = dated.map((t) => toDate(t.start_date!));
    const dues = dated.map((t) => toDate(t.due_date!));
    const minStart = new Date(Math.min(...starts.map((d) => d.getTime())));
    const maxDue = new Date(Math.max(...dues.map((d) => d.getTime())));
    minStart.setDate(minStart.getDate() - 3);
    maxDue.setDate(maxDue.getDate() + 3);
    return { rangeStart: minStart, totalDays: Math.max(diffDays(minStart, maxDue), 14), pxPerDay: px };
  }, [dated, zoom]);

  const totalWidth = totalDays * pxPerDay;

  // Month/week gridline markers for the ruler header.
  const markers = useMemo(() => {
    const out: { leftPx: number; label: string; strong: boolean }[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const isMonthStart = d.getDate() === 1;
      const isWeekStart = d.getDay() === 1; // Monday
      if (isMonthStart) {
        out.push({
          leftPx: i * pxPerDay,
          label: d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
          strong: true,
        });
      } else if (zoom !== "month" && isWeekStart) {
        out.push({ leftPx: i * pxPerDay, label: `${d.getDate()}`, strong: false });
      }
    }
    return out;
  }, [rangeStart, totalDays, pxPerDay, zoom]);

  function depLabel(taskId: string) {
    const dep = dependencies.find((d) => d.task_id === taskId);
    if (!dep) return null;
    const predecessor = tasks.find((t) => t.id === dep.depends_on_task_id);
    return predecessor ? predecessor.name : null;
  }

  const editingTask = tasks.find((t) => t.id === editingId) ?? null;

  async function saveTaskDates(patch: Partial<Task>) {
    if (!editingId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update(patch).eq("id", editingId);
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...patch } : t)));
      router.refresh();
    } else {
      alert("บันทึกไม่สำเร็จ: " + error.message);
    }
    setSaving(false);
  }

  async function saveDependency(dependsOnTaskId: string | null) {
    if (!editingId) return;
    setSaving(true);
    const supabase = createClient();

    const existing = dependencies.find((d) => d.task_id === editingId);
    if (existing) {
      if (!dependsOnTaskId) {
        const { error } = await supabase.from("task_dependencies").delete().eq("id", existing.id);
        if (!error) setDependencies((prev) => prev.filter((d) => d.id !== existing.id));
      } else {
        const { error } = await supabase
          .from("task_dependencies")
          .update({ depends_on_task_id: dependsOnTaskId })
          .eq("id", existing.id);
        if (!error) {
          setDependencies((prev) =>
            prev.map((d) => (d.id === existing.id ? { ...d, depends_on_task_id: dependsOnTaskId } : d))
          );
        }
      }
    } else if (dependsOnTaskId) {
      const { data, error } = await supabase
        .from("task_dependencies")
        .insert({ task_id: editingId, depends_on_task_id: dependsOnTaskId, type: "finish_to_start" })
        .select()
        .single();
      if (!error && data) setDependencies((prev) => [...prev, data]);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {canManage
            ? "คลิกที่แถวเพื่อแก้ไขวันที่ / Dependency / Milestone"
            : "มุมมองอ่านอย่างเดียว (ต้องเป็น Admin หรือ PM ของโครงการจึงจะแก้ไขได้)"}
        </p>
        <div className="flex gap-1 rounded-md border border-slate-200 p-0.5">
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                zoom === z ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {z === "day" ? "Day" : z === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          ยังไม่มี Task ในโครงการนี้ — ไปที่แท็บ Overview เพื่อเพิ่ม Task ก่อน
        </div>
      ) : (
        <>
          {dated.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              ยังไม่มี Task ไหนระบุวันที่ครบทั้ง Start และ Due — คลิกที่ชื่อ Task ด้านล่างเพื่อเพิ่มวันที่ได้เลย
              (แถบเส้นเวลาจะขึ้นหลังใส่วันที่ครบ)
            </div>
          )}
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* Fixed label column */}
          <div className="w-44 flex-shrink-0 border-r border-slate-200">
            <div className="h-9 border-b border-slate-200 bg-slate-50" />
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => canManage && setEditingId(t.id)}
                className="flex h-11 w-full items-center border-b border-slate-100 px-3 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                title={depLabel(t.id) ? `หลังจาก: ${depLabel(t.id)}` : undefined}
              >
                <span className="truncate">{t.name}</span>
                {!(t.start_date && t.due_date) && (
                  <span className="ml-1 flex-shrink-0 text-amber-500" title="ยังไม่ระบุวันที่">
                    ●
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Scrollable chart area */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, position: "relative" }}>
              {/* Ruler header */}
              <div className="relative h-9 border-b border-slate-200 bg-slate-50">
                {markers.map((m, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 h-full border-l ${
                      m.strong ? "border-slate-300" : "border-slate-100"
                    }`}
                    style={{ left: m.leftPx }}
                  >
                    <span
                      className={`ml-1 text-[10px] ${m.strong ? "font-semibold text-slate-600" : "text-slate-400"}`}
                    >
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {tasks.map((t) => {
                const hasDates = t.start_date && t.due_date;
                const startOffset = hasDates ? diffDays(rangeStart, toDate(t.start_date!)) : 0;
                const span = hasDates
                  ? Math.max(diffDays(toDate(t.start_date!), toDate(t.due_date!)) + 1, 1)
                  : 0;
                return (
                  <div
                    key={t.id}
                    className="relative h-11 border-b border-slate-100"
                    style={{ backgroundImage: "none" }}
                  >
                    {markers.map((m, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 h-full border-l ${
                          m.strong ? "border-slate-200" : "border-slate-50"
                        }`}
                        style={{ left: m.leftPx }}
                      />
                    ))}
                    {hasDates && !t.is_milestone && (
                      <button
                        onClick={() => canManage && setEditingId(t.id)}
                        className={`absolute top-2.5 h-6 rounded ${BAR_COLOR[t.status]} flex items-center px-2 text-[10px] font-medium text-white shadow-sm`}
                        style={{ left: startOffset * pxPerDay, width: Math.max(span * pxPerDay, 10) }}
                        title={`${t.name}: ${t.start_date} → ${t.due_date} (${t.progress_percent}%)`}
                      >
                        {span * pxPerDay > 40 ? `${t.progress_percent}%` : ""}
                      </button>
                    )}
                    {hasDates && t.is_milestone && (
                      <button
                        onClick={() => canManage && setEditingId(t.id)}
                        className="absolute top-2.5 h-6 w-6 rotate-45 rounded-sm bg-orange-500 shadow-sm"
                        style={{ left: startOffset * pxPerDay + span * pxPerDay - 12 }}
                        title={`Milestone: ${t.name} (${t.due_date})${t.is_payment_milestone ? " · Payment" : ""}`}
                      />
                    )}
                    {!hasDates && (
                      <button
                        onClick={() => canManage && setEditingId(t.id)}
                        className="absolute top-2.5 left-2 text-[10px] italic text-slate-300 hover:text-slate-400"
                      >
                        ยังไม่ระบุวันที่ — คลิกเพื่อเพิ่ม
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </>
      )}

      {editingTask && (
        <TaskTimelineEditor
          task={editingTask}
          allTasks={tasks}
          dependency={dependencies.find((d) => d.task_id === editingTask.id) ?? null}
          saving={saving}
          onSaveDates={saveTaskDates}
          onSaveDependency={saveDependency}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function TaskTimelineEditor({
  task,
  allTasks,
  dependency,
  saving,
  onSaveDates,
  onSaveDependency,
  onClose,
}: {
  task: Task;
  allTasks: Task[];
  dependency: TaskDependency | null;
  saving: boolean;
  onSaveDates: (patch: Partial<Task>) => Promise<void>;
  onSaveDependency: (dependsOnTaskId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [isMilestone, setIsMilestone] = useState(task.is_milestone);
  const [isPayment, setIsPayment] = useState(task.is_payment_milestone);
  const [dependsOn, setDependsOn] = useState(dependency?.depends_on_task_id ?? "");

  const dependencyTask = allTasks.find((t) => t.id === dependsOn) ?? null;
  const hasConflict =
    dependencyTask?.due_date && startDate ? toDate(startDate) < toDate(dependencyTask.due_date) : false;

  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">แก้ไข Timeline</h3>
        <p className="mb-4 text-xs text-slate-500">{task.name}</p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Dependency (ต้องเสร็จก่อน Task นี้จะเริ่มได้)
          </label>
          <select
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">-- ไม่มี --</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {hasConflict && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠ Start Date เร็วกว่าวันที่ &ldquo;{dependencyTask?.name}&rdquo; จะเสร็จ ({dependencyTask?.due_date}) —
              ยังบันทึกได้ แต่ควรตรวจสอบแผนงานอีกครั้ง
            </p>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
            />
            ตั้งเป็น Milestone
          </label>
          {isMilestone && (
            <label className="ml-6 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPayment}
                onChange={(e) => setIsPayment(e.target.checked)}
              />
              ผูกกับการเบิกงวดงาน (Payment Milestone)
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={async () => {
              await onSaveDates({
                start_date: startDate || null,
                due_date: dueDate || null,
                is_milestone: isMilestone,
                is_payment_milestone: isPayment,
              });
              await onSaveDependency(dependsOn || null);
              onClose();
            }}
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
