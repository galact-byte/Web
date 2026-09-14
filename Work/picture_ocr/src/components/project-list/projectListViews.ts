import type { ProjectGroupSummary, ProjectSummary } from '../../types';

export type ProjectListLocation = { kind: 'groups' } | { kind: 'independent' } | { kind: 'group'; groupId: string };
export interface ProjectListViewState {
  location: ProjectListLocation | null;
  positions: Record<string, { search: string; scrollY: number }>;
}

export function listLocationKey(location: ProjectListLocation): string {
  return location.kind === 'group' ? `group:${location.groupId}` : location.kind;
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

export function filterGroups(groups: ProjectGroupSummary[], search: string): ProjectGroupSummary[] {
  const keyword = search.trim().toLowerCase();
  return groups.filter(summary => [summary.group?.projectCode, summary.group?.projectName, summary.group?.unitName,
    ...summary.systems.map(systemSearchText)].join(' ').toLowerCase().includes(keyword));
}

export function selectedVisibleSystems(systems: ProjectSummary[], selectedIds: Set<string>): ProjectSummary[] {
  return systems.filter(system => selectedIds.has(system.id));
}
