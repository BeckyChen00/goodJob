import type { Job } from "../storage";

export const APPLICATION_STATUSES = ["待投递", "已投递", "测评", "笔试", "一面", "二面", "HR面", "Offer", "拒绝", "放弃"] as const;
export type ApplicationBucket = "pending" | "active" | "offer" | "ended";
export type DeadlineWindow = "all" | "overdue" | "within7" | "within30";
export interface JobFilters { query?: string; statuses?: readonly string[]; deadline?: DeadlineWindow }
export interface ApplicationMetrics { pending: number; active: number; offer: number; ended: number; total: number }

const ENDED_STATUSES = new Set(["拒绝", "放弃"]);

export function applicationBucket(status: string): ApplicationBucket {
  if (status === "待投递") return "pending";
  if (status === "Offer") return "offer";
  if (ENDED_STATUSES.has(status)) return "ended";
  return "active";
}
export function calculateApplicationMetrics(jobs: readonly Job[]): ApplicationMetrics {
  const result: ApplicationMetrics = { pending: 0, active: 0, offer: 0, ended: 0, total: jobs.length };
  for (const job of jobs) result[applicationBucket(job.status)] += 1;
  return result;
}

export function localCalendarDay(value: Date): Date { return new Date(value.getFullYear(), value.getMonth(), value.getDate()) }

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

export function calendarDaysUntil(date: string, today = new Date()): number | null {
  const target = parseLocalDate(date);
  if (!target) return null;
  return Math.round((target.getTime() - localCalendarDay(today).getTime()) / 86_400_000);
}

export function matchesDeadlineWindow(date: string, window: DeadlineWindow, today = new Date()): boolean {
  if (window === "all") return true;
  const days = calendarDaysUntil(date, today);
  if (days === null) return false;
  if (window === "overdue") return days < 0;
  if (window === "within7") return days >= 0 && days <= 7;
  return days >= 0 && days <= 30;
}

export function filterJobs(jobs: readonly Job[], filters: JobFilters, today = new Date()): Job[] {
  const query = filters.query?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const statuses = filters.statuses ?? [];
  const deadline = filters.deadline ?? "all";
  return jobs.filter((job) => `${job.title} ${job.location} ${job.batch}`.toLocaleLowerCase("zh-CN").includes(query)
    && (!statuses.length || statuses.includes(job.status))
    && matchesDeadlineWindow(job.deadline, deadline, today));
}
