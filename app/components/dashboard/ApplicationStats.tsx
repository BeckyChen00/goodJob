import type { ApplicationMetrics } from "../../domain/application-metrics";

const CARDS = [["pending", "待投"], ["active", "进行中"], ["offer", "Offer"], ["ended", "已结束"]] as const;

export function ApplicationStats({ metrics }: { metrics: ApplicationMetrics }) {
  return <section className="application-stats" aria-label="投递状态统计">{CARDS.map(([key, label]) =>
    <div className={`application-stat application-stat-${key}`} key={key}><b>{metrics[key]}</b><span>{label}</span></div>)}</section>;
}
