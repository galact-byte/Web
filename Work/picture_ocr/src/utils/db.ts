import type {
  Asset,
  Category,
  ProjectDocument,
  ProjectGroup,
  ProjectGroupSummary,
  ProjectMeta,
  ProjectSummary,
} from '../types';
import defaultCategories, { createDefaultMeta, createPresetAssets } from '../data/defaults';

const DB_NAME = 'evidence-collector-db';
const DB_VERSION = 3;
const LEGACY_STORE_NAME = 'project';
const PROJECTS_STORE_NAME = 'projects';
const PROJECT_GROUPS_STORE_NAME = 'projectGroups';
const LEGACY_PROJECT_ID = 'current';
const MANAGEMENT_CATEGORY_ID = 'cat-management';
const MANAGEMENT_POLICY_ASSET_NAME = '制度';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        const legacyStore = db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'id' });
        legacyStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        const projectsStore = db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
        projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        projectsStore.createIndex('groupId', 'groupId', { unique: false });
      } else {
        const projectsStore = request.transaction!.objectStore(PROJECTS_STORE_NAME);
        if (!projectsStore.indexNames.contains('groupId')) {
          projectsStore.createIndex('groupId', 'groupId', { unique: false });
        }
      }
      if (!db.objectStoreNames.contains(PROJECT_GROUPS_STORE_NAME)) {
        const groupsStore = db.createObjectStore(PROJECT_GROUPS_STORE_NAME, { keyPath: 'id' });
        groupsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createProjectDocument(
  overrides: Partial<ProjectMeta> = {},
  groupId: string | null = null
): ProjectDocument {
  const now = Date.now();
  const categories = cloneCategories(defaultCategories);
  return normalizeProjectDocument({
    id: genId('project'),
    groupId,
    meta: normalizeMeta({ ...createDefaultMeta(), ...overrides }),
    categories,
    assets: createPresetAssets(categories),
    createdAt: now,
    updatedAt: now,
  });
}

export function createProjectGroup(overrides: Partial<Omit<ProjectGroup, 'id' | 'createdAt' | 'updatedAt'>> = {}): ProjectGroup {
  const now = Date.now();
  return normalizeProjectGroup({
    id: genId('group'),
    projectCode: overrides.projectCode ?? '',
    projectName: overrides.projectName ?? '',
    unitName: overrides.unitName ?? '',
    reportDate: overrides.reportDate ?? createDefaultMeta().reportDate,
    createdAt: now,
    updatedAt: now,
  });
}

export function normalizeProjectDocument(doc: Partial<ProjectDocument> & { id?: string }): ProjectDocument {
  const now = Date.now();
  const categories = normalizeCategories(doc.categories);
  const normalizedDoc: ProjectDocument = {
    id: doc.id || genId('project'),
    groupId: typeof doc.groupId === 'string' && doc.groupId.trim() ? doc.groupId : null,
    meta: normalizeMeta(doc.meta),
    categories,
    assets: cloneAssets(doc.assets ?? []),
    createdAt: doc.createdAt || doc.updatedAt || now,
    updatedAt: doc.updatedAt || now,
  };
  return ensureManagementPolicyAsset(normalizedDoc);
}

export function normalizeProjectGroup(group: Partial<ProjectGroup> & { id?: string }): ProjectGroup {
  const now = Date.now();
  return {
    id: group.id || genId('group'),
    projectCode: group.projectCode?.trim() ?? '',
    projectName: group.projectName?.trim() ?? '',
    unitName: group.unitName?.trim() ?? '',
    reportDate: group.reportDate ?? '',
    createdAt: group.createdAt || group.updatedAt || now,
    updatedAt: group.updatedAt || now,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as ProjectDocument[])
        .map((doc) => toProjectSummary(normalizeProjectDocument(doc)))
        .sort((a, b) => b.updatedAt - a.updatedAt));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function listProjectGroups(): Promise<ProjectGroupSummary[]> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_GROUPS_STORE_NAME], 'readonly');
    const projectsRequest = tx.objectStore(PROJECTS_STORE_NAME).getAll();
    const groupsRequest = tx.objectStore(PROJECT_GROUPS_STORE_NAME).getAll();
    tx.oncomplete = () => {
      db.close();
      const systems = (projectsRequest.result as ProjectDocument[])
        .map((doc) => toProjectSummary(normalizeProjectDocument(doc)));
      const groups = (groupsRequest.result as ProjectGroup[]).map(normalizeProjectGroup);
      resolve(groupProjectSummaries(groups, systems));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveProject(doc: ProjectDocument): Promise<void> {
  const db = await openDB();
  const normalizedDoc = normalizeProjectDocument(doc);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    tx.objectStore(PROJECTS_STORE_NAME).put(normalizedDoc);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function saveProjectGroup(group: ProjectGroup): Promise<void> {
  const db = await openDB();
  const normalizedGroup = normalizeProjectGroup(group);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_GROUPS_STORE_NAME, 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).put(normalizedGroup);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function splitSystemNames(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[，,、\s]+/)
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function createProjectGroupWithSystems(
  groupValues: Pick<ProjectGroup, 'projectCode' | 'projectName' | 'unitName' | 'reportDate'>,
  systemNames: string[]
): Promise<ProjectDocument[]> {
  if (systemNames.length === 0) {
    throw new Error('至少需要一个系统名称');
  }

  const group = createProjectGroup(groupValues);
  const projects = systemNames.map((systemName) => createProjectDocument({ ...group, systemName }, group.id));
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).put(group);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    projects.forEach((project) => projectsStore.put(project));
    tx.oncomplete = () => { db.close(); resolve(projects); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function createSystemForGroup(group: ProjectGroup, systemName: string): Promise<ProjectDocument> {
  const normalizedGroup = normalizeProjectGroup(group);
  const project = createProjectDocument({
    projectCode: normalizedGroup.projectCode,
    projectName: normalizedGroup.projectName,
    unitName: normalizedGroup.unitName,
    reportDate: normalizedGroup.reportDate,
    systemName,
  }, normalizedGroup.id);
  await saveProject(project);
  return project;
}

export async function updateProjectGroupAndSystems(group: ProjectGroup): Promise<void> {
  const normalizedGroup = normalizeProjectGroup({ ...group, updatedAt: Date.now() });
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME], 'readwrite');
    const groupsStore = tx.objectStore(PROJECT_GROUPS_STORE_NAME);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    groupsStore.put(normalizedGroup);
    const matchingSystems = projectsStore.index('groupId').getAll(normalizedGroup.id);
    matchingSystems.onsuccess = () => {
      (matchingSystems.result as ProjectDocument[]).forEach((system) => {
        const normalizedSystem = normalizeProjectDocument(system);
        projectsStore.put({
          ...normalizedSystem,
          meta: {
            ...normalizedSystem.meta,
            projectCode: normalizedGroup.projectCode,
            projectName: normalizedGroup.projectName,
            unitName: normalizedGroup.unitName,
            reportDate: normalizedGroup.reportDate,
          },
          updatedAt: Date.now(),
        });
      });
    };
    matchingSystems.onerror = () => reject(matchingSystems.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadProject(projectId: string): Promise<ProjectDocument | null> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE_NAME).get(projectId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ? normalizeProjectDocument(request.result) : null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function loadProjectGroup(groupId: string): Promise<ProjectGroup | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_GROUPS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECT_GROUPS_STORE_NAME).get(groupId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ? normalizeProjectGroup(request.result) : null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    tx.objectStore(PROJECTS_STORE_NAME).delete(projectId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function deleteProjectGroup(groupId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).delete(groupId);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const matchingSystems = projectsStore.index('groupId').getAllKeys(groupId);
    matchingSystems.onsuccess = () => {
      (matchingSystems.result as IDBValidKey[]).forEach((systemId) => projectsStore.delete(systemId));
    };
    matchingSystems.onerror = () => reject(matchingSystems.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function migrateLegacyProjectIfNeeded(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      db.close();
      resolve();
      return;
    }
    const tx = db.transaction([LEGACY_STORE_NAME, PROJECTS_STORE_NAME], 'readwrite');
    const legacyStore = tx.objectStore(LEGACY_STORE_NAME);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const countRequest = projectsStore.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > 0) return;
      const legacyRequest = legacyStore.get(LEGACY_PROJECT_ID);
      legacyRequest.onsuccess = () => {
        if (!legacyRequest.result) return;
        projectsStore.put(normalizeProjectDocument({ ...legacyRequest.result, id: LEGACY_PROJECT_ID, groupId: null }));
      };
      legacyRequest.onerror = () => reject(legacyRequest.error);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function groupProjectSummaries(groups: ProjectGroup[], systems: ProjectSummary[]): ProjectGroupSummary[] {
  const systemsByGroup = new Map<string, ProjectSummary[]>();
  const ungrouped: ProjectSummary[] = [];
  systems.forEach((system) => {
    if (system.groupId) {
      const current = systemsByGroup.get(system.groupId) ?? [];
      current.push(system);
      systemsByGroup.set(system.groupId, current);
    } else {
      ungrouped.push(system);
    }
  });

  const summaries: ProjectGroupSummary[] = groups.map((group) => ({
    id: group.id,
    group,
    systems: (systemsByGroup.get(group.id) ?? []).sort((a, b) => b.updatedAt - a.updatedAt),
  }));
  systemsByGroup.forEach((orphanedSystems, groupId) => {
    if (!groups.some((group) => group.id === groupId)) {
      summaries.push({ id: groupId, group: null, systems: orphanedSystems.sort((a, b) => b.updatedAt - a.updatedAt) });
    }
  });
  if (ungrouped.length > 0) {
    summaries.push({ id: 'ungrouped', group: null, systems: ungrouped.sort((a, b) => b.updatedAt - a.updatedAt) });
  }
  return summaries.sort((a, b) => getGroupUpdatedAt(b) - getGroupUpdatedAt(a));
}

function getGroupUpdatedAt(summary: ProjectGroupSummary): number {
  return Math.max(summary.group?.updatedAt ?? 0, ...summary.systems.map((system) => system.updatedAt));
}

function normalizeMeta(meta: Partial<ProjectMeta> | undefined): ProjectMeta {
  const legacyMeta = meta as (Partial<ProjectMeta> & { evaluator?: string }) | undefined;
  const defaults = createDefaultMeta();
  return {
    projectCode: legacyMeta?.projectCode ?? '',
    projectName: legacyMeta?.projectName ?? defaults.projectName,
    unitName: legacyMeta?.unitName ?? defaults.unitName,
    systemName: legacyMeta?.systemName ?? '',
    reportDate: legacyMeta?.reportDate ?? defaults.reportDate,
  };
}

function normalizeCategories(categories: Category[] | undefined): Category[] {
  return cloneCategories(categories && categories.length > 0 ? categories : defaultCategories);
}

function ensureManagementPolicyAsset(doc: ProjectDocument): ProjectDocument {
  if (!doc.categories.some((category) => category.id === MANAGEMENT_CATEGORY_ID)) return doc;
  if (doc.assets.some((asset) => asset.categoryId === MANAGEMENT_CATEGORY_ID && asset.name.trim() === MANAGEMENT_POLICY_ASSET_NAME)) return doc;
  return {
    ...doc,
    assets: [...doc.assets, { id: genId('asset'), name: MANAGEMENT_POLICY_ASSET_NAME, categoryId: MANAGEMENT_CATEGORY_ID, items: [] }],
  };
}

function toProjectSummary(doc: ProjectDocument): ProjectSummary {
  return {
    id: doc.id,
    groupId: doc.groupId,
    meta: doc.meta,
    assetCount: doc.assets.length,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function cloneCategories(categories: Category[]): Category[] {
  return categories.map((category) => ({ ...category, defaultItems: (category.defaultItems ?? []).map((item) => ({ ...item })) }));
}

function cloneAssets(assets: Asset[]): Asset[] {
  return assets.map((asset) => ({
    ...asset,
    items: (asset.items ?? []).map((item) => ({ ...item, images: (item.images ?? []).map((image) => ({ ...image })) })),
  }));
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
