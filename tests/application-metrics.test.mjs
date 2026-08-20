import assert from "node:assert/strict";
import test from "node:test";
import { applicationLimitState, calculateApplicationMetrics, calendarDaysUntil, filterJobs, matchesDeadlineWindow, parseLocalDate } from "../app/domain/application-metrics.ts";

const job = (overrides = {}) => ({ id: "job", companyId: "company", title: "后端工程师", batch: "2027 秋招", location: "北京", category: "研发", url: "", jd: "", status: "待投递", appliedAt: "", deadline: "", progress: "", resumeName: "", notes: "", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", ...overrides });

test("组合关键词、状态和截止窗口筛选，清空条件恢复全部记录", () => {
  const today = new Date(2026, 7, 13, 23, 30);
  const jobs = [job({ id: "a", status: "已投递", deadline: "2026-08-18" }), job({ id: "b", title: "产品经理", location: "上海", status: "已投递", deadline: "2026-08-15" }), job({ id: "c", status: "待投递", deadline: "2026-08-18" })];
  assert.deepEqual(filterJobs(jobs, { query: "后端", statuses: ["已投递"], deadline: "within7" }, today).map((item) => item.id), ["a"]);
  assert.equal(filterJobs(jobs, { query: "", statuses: [], deadline: "all" }, today).length, 3);
});

test("关键词匹配岗位名称、地点和批次", () => {
  const jobs = [job({ id: "title" }), job({ id: "location", title: "产品", location: "深圳" }), job({ id: "batch", title: "测试", batch: "春招补录" })];
  assert.deepEqual(filterJobs(jobs, { query: " 深圳 " }).map((item) => item.id), ["location"]);
  assert.deepEqual(filterJobs(jobs, { query: "补录" }).map((item) => item.id), ["batch"]);
});

test("筛选结果保留原岗位对象和企业关联，供正式父子列表直接复用", () => {
  const first = job({ id: "first", companyId: "company-a", status: "笔试" });
  const second = job({ id: "second", companyId: "company-b", status: "待投递" });
  const result = filterJobs([first, second], { statuses: ["笔试"] });
  assert.deepEqual(result.map((item) => item.companyId), ["company-a"]);
  assert.equal(result[0], first);
});

test("任一条件无匹配时返回空集合，清空条件后恢复全部岗位", () => {
  const jobs = [job({ id: "a" }), job({ id: "b", companyId: "company-b" })];
  assert.deepEqual(filterJobs(jobs, { query: "不存在的岗位" }), []);
  assert.deepEqual(filterJobs(jobs, { query: "", statuses: [], deadline: "all" }), jobs);
});

test("四类状态统计互斥且总数不丢失", () => {
  assert.deepEqual(calculateApplicationMetrics([job(), job({ status: "笔试" }), job({ status: "Offer" }), job({ status: "拒绝" }), job({ status: "放弃" })]), { pending: 1, active: 1, offer: 1, ended: 2, total: 5 });
});

test("本地日历日期计算不受当天时间影响", () => {
  assert.equal(calendarDaysUntil("2026-08-14", new Date(2026, 7, 13, 23, 59)), 1);
  assert.equal(calendarDaysUntil("2026-08-12", new Date(2026, 7, 13, 0, 1)), -1);
  assert.equal(matchesDeadlineWindow("2026-08-20", "within7", new Date(2026, 7, 13)), true);
  assert.equal(matchesDeadlineWindow("2026-09-12", "within30", new Date(2026, 7, 13)), true);
});

test("空日期和非法日历日期不进入截止提醒", () => {
  assert.equal(parseLocalDate(""), null);
  assert.equal(parseLocalDate("2026-02-30"), null);
  assert.equal(matchesDeadlineWindow("", "overdue"), false);
  assert.equal(matchesDeadlineWindow("", "all"), true);
});

test("志愿限制覆盖无上限、零、未达到、达到和超过", () => {
  const active = job({ status: "已投递" });
  assert.equal(applicationLimitState({ applicationLimit: null }, [active]).level, "none");
  assert.equal(applicationLimitState({ applicationLimit: 0 }, []).level, "reached");
  assert.equal(applicationLimitState({ applicationLimit: 2 }, [active]).level, "available");
  assert.equal(applicationLimitState({ applicationLimit: 1 }, [active]).level, "reached");
  assert.equal(applicationLimitState({ applicationLimit: 0 }, [active]).level, "exceeded");
  assert.equal(applicationLimitState({ applicationLimit: 0 }, [job({ status: "待投递" })]).used, 0);
});
