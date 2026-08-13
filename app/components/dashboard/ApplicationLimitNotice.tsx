import type { ApplicationLimitState } from "../../domain/application-metrics";

export function ApplicationLimitNotice({ state }: { state: ApplicationLimitState }) {
  if (state.level === "none" || state.level === "available") return null;
  const exceeded = state.level === "exceeded";
  return <p className={`application-limit-notice ${exceeded ? "is-exceeded" : "is-reached"}`} role="status">
    {exceeded ? `已超过志愿上限：已投 ${state.used} / ${state.limit}` : `已达到志愿上限：已投 ${state.used} / ${state.limit}`}
    <span> 提醒不会阻止继续记录岗位。</span>
  </p>;
}
