// Temporary browser adapter for app/domain/job-status.ts.
// Integration owner: replace this mirror with generated/shared JS when the build supports it.
export const JOB_STATUSES = Object.freeze([
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
]);

export const DEFAULT_JOB_STATUS = "待投递";

export const normalizeJobStatus = (value) => (
  JOB_STATUSES.includes(value) ? value : DEFAULT_JOB_STATUS
);
