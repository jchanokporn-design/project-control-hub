import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

const TONE_CLASSES = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONE_CLASSES;
}

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}

export const PROJECT_HEALTH_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  on_track: "green",
  at_risk: "yellow",
  delayed: "red",
  on_hold: "gray",
  completed: "blue",
};

export const TASK_STATUS_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  not_started: "gray",
  in_progress: "blue",
  blocked: "red",
  completed: "green",
  cancelled: "gray",
};

export const PROJECT_HEALTH_LABEL: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
  on_hold: "On Hold",
  completed: "Completed",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};
