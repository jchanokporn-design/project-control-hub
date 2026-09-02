"use client";

import { useMemo, useState } from "react";
import type { TaskStatus } from "@/lib/supabase/types";

interface PortfolioProject {
  id: string;
  project_code: string;
  name: string;
  type: string;
  health: string;
  progress_calculated: number;
  start_date: string | null;
  end_date: string | null;
}

interface PortfolioTask {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  name: string;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  progress_percent: number;
  is_milestone: boolean;
  is_payment_milestone: boolean;
}

type Zoom = "day" | "week" | "month";
const PX_PER_DAY: Record<Zoom, number> = { day: 30, week: 12, month: 4 };

const STATUS_BAR_COLOR: Record<TaskStatus, string> = {
  not_started: "bg-slate-300 text-slate-800",
  in_progress: "bg-blue-500 text-white",
  blocked: "bg-rose-600 text-white",
  completed: "bg-emerald-500 text-white",
  cancelled: "bg-slate-800 text-white",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  blocked: "bg-rose-600",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-800",
};

const LEGEND_ITEMS = [
  { label: "Not Started", swatch: "bg-slate-300" },
  { label: "In Progress", swatch: "bg-blue-500" },
  { label: "Blocked", swatch: "bg-rose-600" },
  { label: "Completed", swatch: "bg-emerald-500" },
  { label: "Cancelled", swatch: "bg-slate-800" },
  { label: "Milestone", swatch: "bg-amber-500", isDiamond: true },
];

const PROJECT_COLORS = ["#1D9E75", "#378ADD", "#D85A30", "#8B5CF6", "#DB2777", "#CA8A04"];
const PROJECT_COL_WIDTH = 240; // px

function toDate(s: string) {
  return new Date(s + "T00:00:00");
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <svg width="32" height="32" className="flex-shrink-0">
      <circle cx="16" cy="16" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}

export function PortfolioGantt({
  projects,
  tasks,
}: {
  projects: PortfolioProject[];
  tasks: PortfolioTask[];
}) {
  const [active, setActive] = useState<Set<string>>(new Set(projects.map((p) => p.id)));
  const [zoom, setZoom] = useState<Zoom>("week");
  const [selected, setSelected] = useState<{ projectId: string; taskId?: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const colorByProject = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p, i) => (m[p.id] = PROJECT_COLORS[i % PROJECT_COLORS.length]));
    return m;
  }, [projects]);

  const tasksByProject = useMemo(() => {
    const m: Record<string, PortfolioTask[]> = {};
    tasks.forEach((t) => {
      (m[t.project_id] ??= []).push(t);
    });
    return m;
  }, [tasks]);

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = diffDays(rangeStart, today);
  const showTodayLine = todayOffset >= 0 && todayOffset <= totalDays;

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

  const shownProjects = projects.filter((p) => active.has(p.id));

  function toggleProject(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRow(projectId: string, taskId?: string) {
    setSelected({ projectId, taskId });
  }

  const selectedProject = projects.find((p) => p.id === selected?.projectId) ?? null;
  const selectedTask = selectedProject
    ? (tasksByProject[selectedProject.id] ?? []).find((t) => t.id === selected?.taskId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            เลือกโครงการ ({active.size}/{projects.length})
            <span className="text-slate-400">{filterOpen ? "▲" : "▼"}</span>
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setFilterOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="flex justify-between px-1.5 py-1 border-b border-slate-100 mb-1">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                    onClick={() => setActive(new Set(projects.map((p) => p.id)))}
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-slate-500 hover:text-slate-800"
                    onClick={() => setActive(new Set())}
                  >
                    ไม่เลือกเลย
                  </button>
                </div>
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={active.has(p.id)}
                      onChange={() => toggleProject(p.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: colorByProject[p.id] }}
                    />
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-slate-400">{p.project_code}</span>{" "}
                      <span className="text-slate-800">— {p.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-1 rounded-md border border-slate-200 p-0.5 bg-white shadow-xs">
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 flex-shrink-0 ${item.swatch} ${
                item.isDiamond ? "rotate-45 rounded-[2px]" : "rounded-sm"
              }`}
            />
            <span className="text-xs text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>

      {shownProjects.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          ยังไม่ได้เลือกโครงการ — คลิกปุ่มเลือกโครงการด้านบนเพื่อแสดงข้อมูล
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Frozen Pane Chart Container */}
          <div className="flex-1 relative max-h-[72vh] overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <div style={{ minWidth: PROJECT_COL_WIDTH + totalWidth }} className="relative">
              
              {/* Sticky Header Row */}
              <div className="sticky top-0 z-30 flex h-9 border-b border-slate-200 bg-slate-50">
                {/* Frozen Top-Left Corner */}
                <div
                  style={{ width: PROJECT_COL_WIDTH }}
                  className="sticky left-0 top-0 z-40 flex flex-shrink-0 items-center justify-between border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600"
                >
                  <span>โครงการ (Projects)</span>
                  <span className="text-[10px] text-slate-400 font-normal">({shownProjects.length})</span>
                </div>

                {/* Sticky Date Ruler */}
                <div className="relative flex-1 h-full bg-slate-50">
                  {markers.map((m, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full border-l ${
                        m.strong ? "border-slate-300" : "border-slate-100"
                      }`}
                      style={{ left: m.leftPx }}
                    >
                      <span
                        className={`ml-1 text-[10px] select-none ${
                          m.strong ? "font-semibold text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body Rows per Project */}
              {shownProjects.map((p) => {
                const pTasks = tasksByProject[p.id] ?? [];
                const isSelected = selected?.projectId === p.id && !selected.taskId;

                return (
                  <div
                    key={p.id}
                    className={`flex h-14 border-b border-slate-100 hover:bg-slate-50/50 group ${
                      isSelected ? "bg-slate-50/80" : ""
                    }`}
                  >
                    {/* Frozen Left Column: Project Info */}
                    <button
                      type="button"
                      onClick={() => selectRow(p.id)}
                      style={{ width: PROJECT_COL_WIDTH }}
                      className={`sticky left-0 z-20 flex flex-shrink-0 items-center gap-2 border-r border-slate-200 bg-white px-2.5 text-left group-hover:bg-slate-50 ${
                        isSelected ? "!bg-slate-50" : ""
                      }`}
                    >
                      <ProgressRing pct={p.progress_calculated} color={colorByProject[p.id]} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-800">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span>{p.project_code}</span>
                          <span>·</span>
                          <span className="font-semibold text-slate-600">{p.progress_calculated}%</span>
                        </div>
                      </div>
                    </button>

                    {/* Right Chart Area */}
                    <div className="relative flex-1 h-full">
                      {/* Gridlines */}
                      {markers.map((m, i) => (
                        <div
                          key={i}
                          className={`absolute top-0 h-full border-l ${
                            m.strong ? "border-slate-200" : "border-slate-50"
                          }`}
                          style={{ left: m.leftPx }}
                        />
                      ))}

                      {/* Today indicator line */}
                      {showTodayLine && (
                        <div
                          className="absolute top-0 z-10 h-full w-px bg-rose-500"
                          style={{ left: todayOffset * pxPerDay }}
                        />
                      )}

                      {/* Project Tasks */}
                      {pTasks.map((t) => {
                        const hasDates = t.start_date && t.due_date;
                        if (!hasDates) return null;
                        const startOffset = diffDays(rangeStart, toDate(t.start_date!));
                        const span = Math.max(diffDays(toDate(t.start_date!), toDate(t.due_date!)) + 1, 1);

                        if (t.is_milestone) {
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => selectRow(p.id, t.id)}
                              className="absolute top-4.5 h-4 w-4 rotate-45 rounded-[2px] bg-amber-500 shadow-xs hover:bg-amber-600 transition-colors"
                              style={{ left: startOffset * pxPerDay + span * pxPerDay - 8 }}
                              title={`Milestone: ${t.name} (${t.due_date})${
                                t.is_payment_milestone ? " · Payment" : ""
                              }`}
                            />
                          );
                        }

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => selectRow(p.id, t.id)}
                            className={`absolute top-4 h-6 rounded ${STATUS_BAR_COLOR[t.status]} px-2 text-left text-[10px] font-medium leading-6 shadow-xs hover:opacity-90 transition-opacity truncate`}
                            style={{
                              left: startOffset * pxPerDay,
                              width: Math.max(span * pxPerDay, 10),
                            }}
                            title={`${t.name}: ${t.start_date} → ${t.due_date} (${t.progress_percent ?? 0}%) [${STATUS_LABEL[t.status]}]`}
                          >
                            {span * pxPerDay > 40 ? `${t.name} (${t.progress_percent ?? 0}%)` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Detail panel */}
          <div className="w-full lg:w-72 flex-shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            {!selectedProject ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                คลิกที่ชื่อโครงการ หรือแท่งงานบน Timeline เพื่อดูรายละเอียดสรุป Task ที่นี่
              </p>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100"
                      style={{ color: colorByProject[selectedProject.id] }}
                    >
                      {selectedProject.type}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">{selectedProject.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">{selectedProject.project_code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-slate-400 hover:text-slate-700 text-xs"
                    title="ปิด"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <p className="text-[10px] text-slate-400">Progress</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedProject.progress_calculated}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <p className="text-[10px] text-slate-400">Target End</p>
                    <p className="text-xs font-semibold text-slate-800">{selectedProject.end_date ?? "—"}</p>
                  </div>
                </div>

                <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Tasks ({tasksByProject[selectedProject.id]?.length ?? 0})
                </p>
                <div className="flex flex-col max-h-80 overflow-y-auto pr-1">
                  {(tasksByProject[selectedProject.id] ?? []).map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0 ${
                        selectedTask?.id === t.id ? "bg-blue-50/60 -mx-2 px-2 rounded-md" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 flex-shrink-0 ${STATUS_DOT[t.status]} ${
                              t.is_milestone ? "rotate-45" : "rounded-full"
                            }`}
                          />
                          <p className="truncate text-xs font-medium text-slate-800">{t.name}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 pl-3.5">
                          {t.start_date && t.due_date ? `${t.start_date} → ${t.due_date}` : "ยังไม่ระบุวันที่"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {t.progress_percent ?? 0}%
                        </span>
                        <span className="text-[10px] text-slate-400">({STATUS_LABEL[t.status]})</span>
                      </div>
                    </div>
                  ))}
                  {(tasksByProject[selectedProject.id] ?? []).length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">ยังไม่มี Task ในโครงการนี้</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
