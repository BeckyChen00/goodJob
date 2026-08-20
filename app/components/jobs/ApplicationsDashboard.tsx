"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Job } from "../../storage";
import { calculateApplicationMetrics, filterJobs, type JobFilters as JobFilterValue } from "../../domain/application-metrics";
import { ApplicationStats } from "../dashboard/ApplicationStats";
import { JobFilters } from "./JobFilters";
import "./applications-dashboard.css";

interface Props {
  /** @deprecated 保留用于入口文件的薄接入兼容；筛选只依赖 jobs。 */
  companies: readonly Company[];
  jobs: readonly Job[];
  onFiltersChange?: (filters: JobFilterValue) => void;
  onFilteredJobsChange?: (jobs: readonly Job[]) => void;
}

const EMPTY_FILTERS: JobFilterValue = { query: "", statuses: [], deadline: "all" };

export function ApplicationsDashboard({ jobs, onFiltersChange, onFilteredJobsChange }: Props) {
  const [filters, setFilters] = useState<JobFilterValue>(EMPTY_FILTERS);
  const shownJobs = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);
  const metrics = useMemo(() => calculateApplicationMetrics(jobs), [jobs]);
  const callbacks = useRef({ onFiltersChange, onFilteredJobsChange });

  useEffect(() => {
    callbacks.current = { onFiltersChange, onFilteredJobsChange };
  }, [onFiltersChange, onFilteredJobsChange]);

  useEffect(() => {
    callbacks.current.onFiltersChange?.(filters);
    callbacks.current.onFilteredJobsChange?.(shownJobs);
  }, [filters, shownJobs]);

  return <section className="applications-dashboard">
    <ApplicationStats metrics={metrics} />
    <JobFilters value={filters} onChange={setFilters} />
    <p className="job-result-count" role="status">
      {shownJobs.length === 0 ? "没有符合当前筛选条件的岗位。" : `筛选结果：${shownJobs.length} / ${jobs.length} 个岗位`}
    </p>
  </section>;
}
