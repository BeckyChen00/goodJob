import { APPLICATION_STATUSES, type DeadlineWindow, type JobFilters as JobFilterValue } from "../../domain/application-metrics";

export function JobFilters({ value, onChange }: { value: JobFilterValue; onChange: (value: JobFilterValue) => void }) {
  const statuses = value.statuses ?? [];
  const toggleStatus = (status: string) => onChange({ ...value, statuses: statuses.includes(status) ? statuses.filter((item) => item !== status) : [...statuses, status] });
  return <section className="job-filters" aria-label="岗位筛选">
    <label className="job-filter-search"><span>搜索岗位</span><input value={value.query ?? ""} placeholder="岗位名称、地点或批次" onChange={(event) => onChange({ ...value, query: event.target.value })} /></label>
    <fieldset><legend>投递状态</legend>{APPLICATION_STATUSES.map((status) => <label key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} />{status}</label>)}</fieldset>
    <label><span>截止时间</span><select value={value.deadline ?? "all"} onChange={(event) => onChange({ ...value, deadline: event.target.value as DeadlineWindow })}>
      <option value="all">全部截止时间</option><option value="overdue">已截止</option><option value="within7">7 天内截止</option><option value="within30">30 天内截止</option>
    </select></label>
    <button type="button" className="secondary" onClick={() => onChange({ query: "", statuses: [], deadline: "all" })}>清空筛选</button>
  </section>;
}
