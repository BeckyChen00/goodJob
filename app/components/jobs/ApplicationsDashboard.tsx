"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Company, Job } from "../../storage";
import { applicationLimitState, calculateApplicationMetrics, filterJobs, type JobFilters as JobFilterValue } from "../../domain/application-metrics";
import { ApplicationLimitNotice } from "../dashboard/ApplicationLimitNotice";
import { ApplicationStats } from "../dashboard/ApplicationStats";
import { DeadlineBadge } from "./DeadlineBadge";
import { JobFilters } from "./JobFilters";
import "./applications-dashboard.css";

interface Props {
  companies: readonly Company[];
  jobs: readonly Job[];
  renderActions?: (job: Job) => ReactNode;
}

const EMPTY_FILTERS: JobFilterValue = { query: "", statuses: [], deadline: "all" };

export function ApplicationsDashboard({ companies, jobs, renderActions }: Props) {
  const [filters, setFilters] = useState<JobFilterValue>(EMPTY_FILTERS);
  const shownJobs = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);
  const metrics = useMemo(() => calculateApplicationMetrics(jobs), [jobs]);
  const companiesById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  return <section className="applications-dashboard">
    <ApplicationStats metrics={metrics} />
    <JobFilters value={filters} onChange={setFilters} />
    <p className="job-result-count">显示 {shownJobs.length} / {jobs.length} 个岗位</p>
    {shownJobs.length === 0 ? <div className="empty">没有符合当前筛选条件的岗位。</div> : <div className="application-job-list">
      {shownJobs.map((job) => {
        const company = companiesById.get(job.companyId);
        const companyJobs = jobs.filter((item) => item.companyId === job.companyId);
        return <article className="application-job-card" key={job.id}>
          <div className="application-job-heading"><div><p>{company?.name ?? "未知企业"}</p><h3>{job.title || "未命名岗位"}</h3></div><span className="status">{job.status}</span></div>
          {company && <ApplicationLimitNotice state={applicationLimitState(company, companyJobs)} />}
          <dl><div><dt>地点</dt><dd>{job.location || "未填写"}</dd></div><div><dt>批次</dt><dd>{job.batch || "未填写"}</dd></div><div><dt>截止提醒</dt><dd><DeadlineBadge deadline={job.deadline} /></dd></div></dl>
          {job.jd && <details><summary>查看 JD</summary><p className="application-job-jd">{job.jd}</p></details>}
          {renderActions && <div className="application-job-actions">{renderActions(job)}</div>}
        </article>;
      })}
    </div>}
  </section>;
}
