"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  name: string;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  is_milestone: boolean;
  is_payment_milestone: boolean;
}

type Zoom = "day" | "week" | "month";
const PX_PER_DAY: Record<Zoom, number> = { day: 30, week: 12, month: 4 };

const STATUS_BAR_COLOR: Record<TaskStatus, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-200",
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
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-200",
};

const PROJECT_COLORS = ["#1D9E75", "#378ADD", "#D85A30", "#8B5CF6", "#DB2777", "#CA8A04"];

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
      const isWeekStart = d.getDay() === 1;
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

  function toISO(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  const tasksInProgress = shownProjects.reduce(
    (n, p) => n + (tasksByProject[p.id] ?? []).filter((t) => t.status === "in_progress").length,
    0
  );
  const soonestEnding = shownProjects
    .filter((p) => p.end_date && p.progress_calculated < 100)
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : 1))[0];
  const upcomingMilestones = shownProjects
    .flatMap((p) =>
      (tasksByProject[p.id] ?? [])
        .filter((t) => t.is_milestone && t.due_date && t.due_date >= toISO(today))
        .map((t) => ({ ...t, projectName: p.name }))
    )
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];

  function toggleProject(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Clicking the same project/task row again closes the detail panel;
  // clicking a different one opens it with the new selection.
  function selectRow(projectId: string, taskId?: string) {
    setSelected((prev) => {
      const isSame = prev?.projectId === projectId && prev?.taskId === taskId;
      return isSame ? null : { projectId, taskId };
    });
  }

  const [filterOpen, setFilterOpen] = useState(false);

  const selectedProject = selected ? projects.find((p) => p.id === selected.projectId) ?? null : null;
  const selectedTask =
    selected?.taskId ? tasksByProject[selected.projectId]?.find((t) => t.id === selected.taskId) ?? null : null;

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        ยังไม่มีโครงการให้แสดง — ไปที่หน้า Projects เพื่อสร้างโครงการก่อน
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-900 p-3 text-white">
          <p className="text-[11px] opacity-75">Active projects</p>
          <p className="mt-1 text-lg font-semibold">
            {active.size} <span className="text-xs font-normal opacity-70">of {projects.length} shown</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-400">Tasks in progress</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{tasksInProgress}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-400">Completing soonest</p>
          {soonestEnding ? (
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {soonestEnding.name}
              <span className="block text-xs font-normal text-slate-400">{soonestEnding.end_date}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">—</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-400">Next milestone</p>
          {upcomingMilestones ? (
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {upcomingMilestones.due_date}
              <span className="block text-xs font-normal text-slate-400">{upcomingMilestones.name}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">—</p>
          )}
        </div>
      </div>

      {/* Filters + zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Projects ({active.size}/{projects.length})
            <span className="text-slate-400">{filterOpen ? "▲" : "▼"}</span>
          </button>
          {filterOpen && (
            <>
              {/* click-away layer */}
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                <div className="flex justify-between px-1.5 py-1">
                  <button
                    type="button"
                    className="text-[11px] text-slate-500 hover:text-slate-800"
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
                      className="h-3.5 w-3.5 flex-shrink-0"
                    />
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: colorByProject[p.id] }} />
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

      {shownProjects.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          ยังไม่ได้เลือกโครงการ — คลิกป้ายโครงการด้านบนเพื่อแสดงบนเส้นเวลา
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Chart */}
          <div className="flex flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="w-40 flex-shrink-0 border-r border-slate-200">
              <div className="h-9 border-b border-slate-200 bg-slate-50" />
              {shownProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectRow(p.id)}
                  className={`flex h-14 w-full items-center gap-2 border-b border-slate-100 px-2.5 text-left hover:bg-slate-50 ${
                    selected?.projectId === p.id && !selected.taskId ? "bg-slate-50" : ""
                  }`}
                >
                  <ProgressRing pct={p.progress_calculated} color={colorByProject[p.id]} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.progress_calculated}%</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto">
              <div style={{ width: totalWidth, position: "relative" }}>
                <div className="relative h-9 border-b border-slate-200 bg-slate-50">
                  {markers.map((m, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full border-l ${m.strong ? "border-slate-300" : "border-slate-100"}`}
                      style={{ left: m.leftPx }}
                    >
                      <span className={`ml-1 text-[10px] ${m.strong ? "font-semibold text-slate-600" : "text-slate-400"}`}>
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>

                {shownProjects.map((p) => {
                  const pTasks = tasksByProject[p.id] ?? [];
                  return (
                    <div key={p.id} className="relative h-14 border-b border-slate-100">
                      {markers.map((m, i) => (
                        <div
                          key={i}
                          className={`absolute top-0 h-full border-l ${m.strong ? "border-slate-200" : "border-slate-50"}`}
                          style={{ left: m.leftPx }}
                        />
                      ))}
                      {showTodayLine && (
                        <div
                          className="absolute top-0 z-10 h-full w-px bg-red-400"
                          style={{ left: todayOffset * pxPerDay }}
                        />
                      )}
                      {pTasks.map((t) => {
                        const hasDates = t.start_date && t.due_date;
                        if (!hasDates) return null;
                        const startOffset = diffDays(rangeStart, toDate(t.start_date!));
                        const span = Math.max(diffDays(toDate(t.start_date!), toDate(t.due_date!)) + 1, 1);
                        if (t.is_milestone) {
                          return (
                            <button
                              key={t.id}
                              onClick={() => selectRow(p.id, t.id)}
                              className="absolute top-4 h-3.5 w-3.5 rotate-45 rounded-sm bg-amber-500 shadow-sm"
                              style={{ left: startOffset * pxPerDay + span * pxPerDay - 7 }}
                              title={t.name}
                            />
                          );
                        }
                        return (
                          <button
                            key={t.id}
                            onClick={() => selectRow(p.id, t.id)}
                            className={`absolute top-4 h-5 rounded ${STATUS_BAR_COLOR[t.status]} px-1.5 text-left text-[10px] font-medium leading-5 text-white shadow-sm`}
                            style={{ left: startOffset * pxPerDay, width: Math.max(span * pxPerDay, 10) }}
                            title={`${t.name}: ${t.start_date} → ${t.due_date}`}
                          >
                            {span * pxPerDay > 44 ? t.name : ""}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="hidden w-64 flex-shrink-0 rounded-lg border border-slate-200 bg-white p-4 sm:block">
            {!selectedProject ? (
              <p className="text-sm text-slate-400">คลิกที่ชื่อโครงการ หรือแท่งงาน เพื่อดูรายละเอียด Task ที่นี่</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: colorByProject[selectedProject.id] }}
                  >
                    {selectedProject.type}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700"
                    title="ปิด"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedProject.name}</p>

                <div className="mt-3 flex gap-2">
                  <div className="flex-1 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400">Progress</p>
                    <p className="text-sm font-semibold">{selectedProject.progress_calculated}%</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400">Target</p>
                    <p className="text-sm font-semibold">{selectedProject.end_date ?? "—"}</p>
                  </div>
                </div>

                <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tasks</p>
                <div className="flex flex-col">
                  {(tasksByProject[selectedProject.id] ?? []).map((t) => (
                    <div
                      key={t.id}
                      className={`flex gap-2 border-b border-slate-100 py-1.5 last:border-b-0 ${
                        selectedTask?.id === t.id ? "-mx-2 rounded-md bg-slate-50 px-2" : ""
                      }`}
                    >
                      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[t.status]}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-slate-800">{t.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {STATUS_LABEL[t.status]}
                          {t.is_milestone ? " · Milestone" : ""}
                        </span>
                      </span>
                    </div>
                  ))}
                  {(tasksByProject[selectedProject.id] ?? []).length === 0 && (
                    <p className="text-xs text-slate-400">ยังไม่มี Task</p>
                  )}
                </div>

                <Link
                  href={`/projects/${selectedProject.id}`}
                  className="mt-4 flex items-center justify-center gap-1 rounded-md bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-700"
                >
                  Open project →
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile fallback: detail panel below chart on small screens */}
      {selectedProject && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:hidden">
          <p className="text-sm font-semibold text-slate-900">{selectedProject.name}</p>
          <p className="text-xs text-slate-400">
            {selectedProject.progress_calculated}% · Target {selectedProject.end_date ?? "—"}
          </p>
          <Link
            href={`/projects/${selectedProject.id}`}
            className="mt-3 flex items-center justify-center gap-1 rounded-md bg-slate-900 py-2 text-xs font-medium text-white"
          >
            Open project →
          </Link>
        </div>
      )}
    </div>
  );
}
