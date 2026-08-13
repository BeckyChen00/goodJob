import { calendarDaysUntil } from "../../domain/application-metrics";

export function DeadlineBadge({ deadline, today }: { deadline: string; today?: Date }) {
  const days = calendarDaysUntil(deadline, today);
  if (days === null) return <span className="deadline-badge is-empty">未设置截止日期</span>;
  if (days < 0) return <span className="deadline-badge is-overdue">已截止 {Math.abs(days)} 天</span>;
  if (days === 0) return <span className="deadline-badge is-urgent">今天截止</span>;
  if (days <= 7) return <span className="deadline-badge is-urgent">{days} 天内截止</span>;
  if (days <= 30) return <span className="deadline-badge is-upcoming">{days} 天内截止</span>;
  return <span className="deadline-badge">截止 {deadline}</span>;
}
