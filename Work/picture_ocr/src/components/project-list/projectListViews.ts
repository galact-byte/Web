import type { ProjectGroupSummary, ProjectSummary } from '../../types';

export type ProjectListLocation = { kind: 'groups' } | { kind: 'independent' };
export interface ProjectListViewState {
  location: ProjectListLocation | null;
  positions: Record<string, { search: string; scrollY: number }>;
  expandedGroupIds: string[] | null;
  searchExpandedGroupIds: string[] | null;
}

export function listLocationKey(location: ProjectListLocation): string {
  return location.kind;
}

export function getSystemDisplayName(project: ProjectSummary): string {
  return project.meta.systemName.trim() || '未命名系统';
}

/** 与 lanGroupSnapshot 同一规则：项目名称优先，空时回退单位名称（#165）。 */
export function getGroupDisplayName(summary: ProjectGroupSummary): string {
  const group = summary.group;
  if (!group) return summary.systems[0]?.meta.projectName.trim() || '项目组记录缺失';
  return group.projectName.trim() || group.unitName.trim() || '未命名项目组';
}

export function formatTime(timestamp: number): string {
  return timestamp
    ? new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-';
}

export function groupUpdatedAt(summary: ProjectGroupSummary): number {
  return summary.systems.reduce((latest, system) => Math.max(latest, system.updatedAt), summary.group?.updatedAt ?? 0);
}

export function splitProjectViews(summaries: ProjectGroupSummary[]) {
  return {
    projects: summaries.filter(summary => summary.group || summary.systems.some(system => system.groupId))
      .sort((a, b) => groupUpdatedAt(b) - groupUpdatedAt(a)),
    independent: summaries.flatMap(summary => summary.systems).filter(system => !system.groupId)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

function systemSearchText(system: ProjectSummary): string {
  return [system.meta.projectCode, system.meta.projectName, system.meta.unitName, system.meta.systemName].join(' ');
}

export function filterSystems(systems: ProjectSummary[], search: string): ProjectSummary[] {
  const keyword = search.trim().toLowerCase();
  return systems.filter(system => systemSearchText(system).toLowerCase().includes(keyword));
}

function matchesGroup(summary: ProjectGroupSummary, search: string): boolean {
  const meta = summary.group ?? summary.systems[0]?.meta;
  return [meta?.projectCode, meta?.projectName, meta?.unitName].join(' ').toLowerCase().includes(search.trim().toLowerCase());
}

export function filterGroupSystems(summary: ProjectGroupSummary, search: string): ProjectSummary[] {
  return matchesGroup(summary, search) ? summary.systems : filterSystems(summary.systems, search);
}

export function filterGroups(groups: ProjectGroupSummary[], search: string): ProjectGroupSummary[] {
  return groups.filter(summary => matchesGroup(summary, search) || filterSystems(summary.systems, search).length > 0);
}

export function syncExpandedGroups(ids: string[] | null, groups: ProjectGroupSummary[]): string[] {
  const available = new Set(groups.map(group => group.id));
  return ids === null ? [...available] : ids.filter(id => available.has(id));
}

export function selectedVisibleSystems(systems: ProjectSummary[], selectedIds: Set<string>): ProjectSummary[] {
  return systems.filter(system => selectedIds.has(system.id));
}
