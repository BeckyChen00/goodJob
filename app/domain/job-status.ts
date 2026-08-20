export const JOB_STATUSES = [
  "待投递",
  "已投递",
  "测评",
  "笔试",
  "一面",
  "二面",
  "HR面",
  "Offer",
  "拒绝",
  "放弃",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const DEFAULT_JOB_STATUS: JobStatus = "待投递";

const JOB_STATUS_SET: ReadonlySet<string> = new Set(JOB_STATUSES);

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && JOB_STATUS_SET.has(value);
}

/**
 * Normalizes data arriving from older extension drafts or other untrusted inputs.
 * Whitespace around a valid value is tolerated; missing and unknown values fall
 * back to the frozen default so arbitrary strings never reach storage.
 */
export function normalizeJobStatus(value: unknown): JobStatus {
  const candidate = typeof value === "string" ? value.trim() : value;
  return isJobStatus(candidate) ? candidate : DEFAULT_JOB_STATUS;
}

export type ExtensionJobDraftLike = { status?: unknown } | null | undefined;

/** Returns null for company-only drafts and a safe status for job drafts. */
export function statusFromExtensionJob(job: ExtensionJobDraftLike): JobStatus | null {
  return job == null ? null : normalizeJobStatus(job.status);
}
