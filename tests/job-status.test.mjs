import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_JOB_STATUS,
  JOB_STATUSES,
  isJobStatus,
  normalizeJobStatus,
  statusFromExtensionJob,
} from "../app/domain/job-status.ts";
import { filterJobs } from "../app/domain/application-metrics.ts";

const ALL_STATUSES = ["待投递", "已投递", "测评", "笔试", "一面", "二面", "HR面", "Offer", "拒绝", "放弃"];

const job = (id, status, overrides = {}) => ({
  id,
  companyId: "company",
  title: "测试开发工程师",
  batch: "2027 秋招",
  location: "北京",
  category: "研发",
  url: "",
  jd: "",
  status,
  appliedAt: "",
  deadline: "2026-08-25",
  progress: "",
  resumeName: "",
  notes: "",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  ...overrides,
});

test("job status contract exposes exactly the ten frozen statuses", () => {
  assert.deepEqual([...JOB_STATUSES], ALL_STATUSES);
  assert.equal(DEFAULT_JOB_STATUS, "待投递");
  for (const status of ALL_STATUSES) {
    assert.equal(isJobStatus(status), true);
    assert.equal(normalizeJobStatus(status), status);
  }
});

test("legacy missing and invalid statuses normalize to the safe default", () => {
  for (const value of [undefined, null, "", "未知", 1, {}, []]) {
    assert.equal(isJobStatus(value), false);
    assert.equal(normalizeJobStatus(value), "待投递");
  }
  assert.equal(normalizeJobStatus("  已投递  "), "已投递");
});

test("extension job drafts retain valid status and sanitize unsafe status", () => {
  assert.equal(statusFromExtensionJob({ status: "HR面" }), "HR面");
  assert.equal(statusFromExtensionJob({}), "待投递");
  assert.equal(statusFromExtensionJob({ status: "自定义状态" }), "待投递");
});

test("company-only extension drafts do not produce a job status", () => {
  assert.equal(statusFromExtensionJob(null), null);
  assert.equal(statusFromExtensionJob(undefined), null);
});

test("shared filter logic still combines keyword, status, and deadline", () => {
  const jobs = [
    job("matching", "已投递"),
    job("wrong-status", "笔试"),
    job("wrong-query", "已投递", { title: "产品经理" }),
    job("expired", "已投递", { deadline: "2026-08-19" }),
  ];
  const result = filterJobs(
    jobs,
    { query: "测试", statuses: ["已投递"], deadline: "within7" },
    new Date(2026, 7, 20),
  );
  assert.deepEqual(result.map((item) => item.id), ["matching"]);
});
