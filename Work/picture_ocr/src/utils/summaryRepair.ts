/**
 * 项目文档与列表摘要的一致性核对（纯逻辑，便于单独验证）。
 *
 * 背景：列表只读 projectSummaries，若某条项目文档没有对应摘要，它就会从列表和计数里彻底消失
 * （v0.6.1 遇到读不出内容的坏记录时直接跳过，正是这样丢了一个项目）。因此改为按主键集合求差，
 * 缺哪条补哪条，而不是用「摘要数 >= 项目数」这种近似判断。
 * IndexedDB 主键理论上可能不是字符串，比对统一转成字符串避免类型不一致漏判。
 */
export interface SummaryRepairPlan {
  /** 有项目文档但缺摘要，需要补建。 */
  missing: IDBValidKey[];
  /** 有摘要但项目文档已不存在，需要清理，避免列表里出现点不开的幽灵条目。 */
  orphans: IDBValidKey[];
}

export function planSummaryRepair(projectKeys: IDBValidKey[], summaryKeys: IDBValidKey[]): SummaryRepairPlan {
  const summarySet = new Set(summaryKeys.map((key) => String(key)));
  const projectSet = new Set(projectKeys.map((key) => String(key)));
  return {
    missing: projectKeys.filter((key) => !summarySet.has(String(key))),
    orphans: summaryKeys.filter((key) => !projectSet.has(String(key))),
  };
}

/** 一次自检修复的结果，供启动提示与诊断包使用。 */
export interface SummaryRepairReport {
  projectCount: number;
  summaryCount: number;
  /** 检出的缺摘要条数。 */
  missing: number;
  /** 成功补建摘要的条数（这些项目会重新出现在列表里）。 */
  repaired: number;
  /** 清理掉的孤立摘要条数。 */
  removedOrphans: number;
  /** 内容读不出来的记录主键，需人工介入，不再静默跳过。 */
  damagedIds: string[];
}

// 与缓存报告同属页面会话生命周期，不能随列表组件卸载而重置。
const notifiedReports = new WeakSet<SummaryRepairReport>();

export function claimSummaryRepairNotice(report: SummaryRepairReport | null): boolean {
  if (!report || notifiedReports.has(report) || (report.repaired === 0 && report.damagedIds.length === 0)) return false;
  notifiedReports.add(report);
  return true;
}

export function createEmptyRepairReport(): SummaryRepairReport {
  return { projectCount: 0, summaryCount: 0, missing: 0, repaired: 0, removedOrphans: 0, damagedIds: [] };
}
