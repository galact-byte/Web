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
import { recordError } from './errorLog';
import { trackWrite } from './pendingWrites';
import { createEmptyRepairReport, planSummaryRepair, type SummaryRepairReport } from './summaryRepair';

const DB_NAME = 'evidence-collector-db';
const DB_VERSION = 4;
const LEGACY_STORE_NAME = 'project';
const PROJECTS_STORE_NAME = 'projects';
const PROJECT_GROUPS_STORE_NAME = 'projectGroups';
const PROJECT_SUMMARIES_STORE_NAME = 'projectSummaries';
const LEGACY_PROJECT_ID = 'current';

// 存储操作超时兜底：卡死超过该阈值时以明确错误返回，避免 UI 无限转圈。
const DB_OP_TIMEOUT_MS = 15000;
// openDB 首次打开可能伴随 v3→v4 逐条回填摘要，放宽超时避免大库迁移被误断。
const DB_OPEN_TIMEOUT_MS = 60000;
// 写入整份项目文档（内联 Base64，可能上百 MB）耗时远超读取；用读操作的 15s 卡这里会把
// 「还在写」误判成「保存失败」，而 withTimeout 只是 reject，底层事务并不会取消，因此写路径放宽。
const DB_DOC_TIMEOUT_MS = 120000;

function withTimeout<T>(op: Promise<T>, label: string, timeoutMs = DB_OP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`IndexedDB 操作超时（${label}），数据量过大或数据库被占用`);
      recordError({ type: 'manual', message: error.message, context: `db:${label}` });
      reject(error);
    }, timeoutMs);
    op.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => {
        clearTimeout(timer);
        recordError({
          type: 'manual',
          message: `IndexedDB 操作失败（${label}）：${error instanceof Error ? error.message : String(error)}`,
          stack: error instanceof Error ? error.stack : undefined,
          context: `db:${label}`,
        });
        reject(error);
      }
    );
  });
}

function openDB(): Promise<IDBDatabase> {
  return withTimeout(new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      // 升级事务里只做「建表 / 建索引」等结构变更，绝不遍历数据。
      // 任何在 versionchange 事务回调里抛出的异常都会中止整个升级并回滚版本，
      // 使 DB 永久卡在旧版本、之后每次 open 都重跑并再次崩溃（v0.6.0 摘要回填游标即因坏记录读 .id 抛错触发此问题）。
      // 因此摘要回填改到 openDB 成功后的普通事务（ensureSummariesBackfilled），并对结构变更整体做 try/catch 兜底。
      const db = request.result;
      const tx = request.transaction!;
      try {
        if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
          const legacyStore = db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'id' });
          legacyStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
          const projectsStore = db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
          projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectsStore.createIndex('groupId', 'groupId', { unique: false });
        } else {
          const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
          if (!projectsStore.indexNames.contains('groupId')) {
            projectsStore.createIndex('groupId', 'groupId', { unique: false });
          }
        }
        if (!db.objectStoreNames.contains(PROJECT_GROUPS_STORE_NAME)) {
          const groupsStore = db.createObjectStore(PROJECT_GROUPS_STORE_NAME, { keyPath: 'id' });
          groupsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        // v3 → v4：只创建空的轻量摘要 store，存量回填延后到升级完成后执行（见 ensureSummariesBackfilled）。
        if (!db.objectStoreNames.contains(PROJECT_SUMMARIES_STORE_NAME)) {
          const summariesStore = db.createObjectStore(PROJECT_SUMMARIES_STORE_NAME, { keyPath: 'id' });
          summariesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      } catch (error) {
        recordError({
          type: 'manual',
          message: `IndexedDB 升级失败（onupgradeneeded）：${error instanceof Error ? error.message : String(error)}`,
          stack: error instanceof Error ? error.stack : undefined,
          context: 'db:onupgradeneeded',
        });
        try { tx.abort(); } catch { /* 事务可能已中止，忽略 */ }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('数据库升级被占用（onblocked），请关闭其他打开本工具的窗口后重试'));
  }), 'openDB', DB_OPEN_TIMEOUT_MS);
}

// 摘要 store 自检修复：按主键集合求差，缺摘要的补、孤立摘要的删。
// 不用「摘要数 >= 项目数」这种近似判断——数目相等也可能是「补了一条新的、漏了一条旧的」，
// 那条漏掉的项目就会永久从列表消失（v0.6.1 跳过坏记录即造成用户少了一个项目）。
let summariesSyncDone = false;
let lastRepairReport: SummaryRepairReport | null = null;

/** 最近一次存储自检结果，供启动提示与诊断包读取（尚未自检时为 null）。 */
export function getLastSummaryRepairReport(): SummaryRepairReport | null {
  return lastRepairReport;
}

export async function ensureSummariesSynced(force = false): Promise<SummaryRepairReport> {
  if (summariesSyncDone && !force && lastRepairReport) return lastRepairReport;
  const db = await openDB();
  const report = await withTimeout(new Promise<SummaryRepairReport>((resolve, reject) => {
    if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME) || !db.objectStoreNames.contains(PROJECT_SUMMARIES_STORE_NAME)) {
      db.close();
      resolve(createEmptyRepairReport());
      return;
    }
    const result = createEmptyRepairReport();
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    const projectKeysRequest = projectsStore.getAllKeys();
    const summaryKeysRequest = summariesStore.getAllKeys();
    let projectKeys: IDBValidKey[] | undefined;
    let summaryKeys: IDBValidKey[] | undefined;

    // 逐条补建：一次只把一条项目文档读进内存（文档内联 Base64，单条可能上百 MB），
    // 并发发起全部 get 会造成内存尖峰甚至 OOM。
    const repairNext = (queue: IDBValidKey[], index: number) => {
      if (index >= queue.length) return;
      const key = queue[index];
      const getRequest = projectsStore.get(key);
      getRequest.onsuccess = () => {
        const raw = getRequest.result as (Partial<ProjectDocument> & { id?: string }) | null | undefined;
        if (raw && typeof raw === 'object') {
          // 记录体里的 id 可能缺失或损坏，主键才是权威来源；用主键兜底才不会让整条项目从列表消失。
          summariesStore.put(summaryFromRaw({ ...raw, id: String(key) }));
          result.repaired += 1;
        } else {
          result.damagedIds.push(String(key));
        }
        repairNext(queue, index + 1);
      };
      getRequest.onerror = (event) => {
        // 单条记录读失败（值已损坏）不能中止整个事务，否则一条坏记录会让其余修复全部回滚。
        event.preventDefault();
        event.stopPropagation();
        result.damagedIds.push(String(key));
        repairNext(queue, index + 1);
      };
    };

    // 两个 getAllKeys 完成顺序不可依赖，各自回写结果，齐了再由后完成的回调同步发起修复请求，
    // 保证事务在补建期间保持活跃、不提前提交。
    const maybeSync = () => {
      if (!projectKeys || !summaryKeys) return;
      result.projectCount = projectKeys.length;
      result.summaryCount = summaryKeys.length;
      const plan = planSummaryRepair(projectKeys, summaryKeys);
      result.missing = plan.missing.length;
      plan.orphans.forEach((key) => {
        summariesStore.delete(key);
        result.removedOrphans += 1;
      });
      repairNext(plan.missing, 0);
    };

    projectKeysRequest.onsuccess = () => { projectKeys = projectKeysRequest.result; maybeSync(); };
    summaryKeysRequest.onsuccess = () => { summaryKeys = summaryKeysRequest.result; maybeSync(); };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'ensureSummariesSynced', DB_DOC_TIMEOUT_MS);

  summariesSyncDone = true;
  lastRepairReport = report;
  if (report.missing > 0 || report.removedOrphans > 0 || report.damagedIds.length > 0) {
    recordError({
      type: 'manual',
      message: `存储自检：项目 ${report.projectCount} 条 / 摘要 ${report.summaryCount} 条，补建 ${report.repaired} 条，`
        + `清理孤立摘要 ${report.removedOrphans} 条，无法读取 ${report.damagedIds.length} 条`
        + (report.damagedIds.length ? `（${report.damagedIds.join('、')}）` : ''),
      context: 'db:summaryRepair',
    });
  }
  return report;
}

/** 各 store 的真实条数与遗留数据状态，用于诊断「列表看不到但库里还在」这类漂移。 */
export interface StoreDiagnostics {
  projects: number;
  summaries: number;
  groups: number;
  legacy: number;
  /** 旧版单项目记录仍在 legacy store，且从未迁移进 projects store。 */
  legacyStranded: boolean;
}

export async function getStoreDiagnostics(): Promise<StoreDiagnostics> {
  const db = await openDB();
  return withTimeout(new Promise<StoreDiagnostics>((resolve, reject) => {
    const result: StoreDiagnostics = { projects: 0, summaries: 0, groups: 0, legacy: 0, legacyStranded: false };
    const names = [PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, PROJECT_GROUPS_STORE_NAME, LEGACY_STORE_NAME]
      .filter((name) => db.objectStoreNames.contains(name));
    if (names.length === 0) {
      db.close();
      resolve(result);
      return;
    }
    const tx = db.transaction(names, 'readonly');
    const countInto = (name: string, assign: (value: number) => void) => {
      if (!names.includes(name)) return;
      const request = tx.objectStore(name).count();
      request.onsuccess = () => assign(request.result);
    };
    countInto(PROJECTS_STORE_NAME, (value) => { result.projects = value; });
    countInto(PROJECT_SUMMARIES_STORE_NAME, (value) => { result.summaries = value; });
    countInto(PROJECT_GROUPS_STORE_NAME, (value) => { result.groups = value; });
    countInto(LEGACY_STORE_NAME, (value) => { result.legacy = value; });
    if (names.includes(LEGACY_STORE_NAME) && names.includes(PROJECTS_STORE_NAME)) {
      const migratedKey = tx.objectStore(PROJECTS_STORE_NAME).getKey(LEGACY_PROJECT_ID);
      migratedKey.onsuccess = () => { result.legacyStranded = result.legacy > 0 && migratedKey.result === undefined; };
    }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'getStoreDiagnostics');
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
  return normalizedDoc;
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
  await ensureSummariesSynced();
  const db = await openDB();
  return withTimeout(new Promise<ProjectSummary[]>((resolve, reject) => {
    const tx = db.transaction(PROJECT_SUMMARIES_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as ProjectSummary[])
        .map(normalizeSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  }), 'listProjects');
}

export async function listProjectGroups(): Promise<ProjectGroupSummary[]> {
  await migrateLegacyProjectIfNeeded();
  await ensureSummariesSynced();
  const db = await openDB();
  return withTimeout(new Promise<ProjectGroupSummary[]>((resolve, reject) => {
    const tx = db.transaction([PROJECT_SUMMARIES_STORE_NAME, PROJECT_GROUPS_STORE_NAME], 'readonly');
    const summariesRequest = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).getAll();
    const groupsRequest = tx.objectStore(PROJECT_GROUPS_STORE_NAME).getAll();
    tx.oncomplete = () => {
      db.close();
      const systems = (summariesRequest.result as ProjectSummary[]).map(normalizeSummary);
      const groups = (groupsRequest.result as ProjectGroup[]).map(normalizeProjectGroup);
      resolve(groupProjectSummaries(groups, systems));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }), 'listProjectGroups');
}

export async function saveProject(doc: ProjectDocument): Promise<void> {
  const db = await openDB();
  const normalizedDoc = normalizeProjectDocument(doc);
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECTS_STORE_NAME).put(normalizedDoc);
    tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).put(toProjectSummary(normalizedDoc));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'saveProject', DB_DOC_TIMEOUT_MS));
}

export async function saveProjectGroup(group: ProjectGroup): Promise<void> {
  const db = await openDB();
  const normalizedGroup = normalizeProjectGroup(group);
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECT_GROUPS_STORE_NAME, 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).put(normalizedGroup);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'saveProjectGroup', DB_DOC_TIMEOUT_MS));
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
  return withTimeout(new Promise<ProjectDocument[]>((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).put(group);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    projects.forEach((project) => {
      projectsStore.put(project);
      summariesStore.put(toProjectSummary(project));
    });
    tx.oncomplete = () => { db.close(); resolve(projects); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'createProjectGroupWithSystems', DB_DOC_TIMEOUT_MS);
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
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    const groupsStore = tx.objectStore(PROJECT_GROUPS_STORE_NAME);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    groupsStore.put(normalizedGroup);
    const matchingSystems = projectsStore.index('groupId').getAll(normalizedGroup.id);
    matchingSystems.onsuccess = () => {
      (matchingSystems.result as ProjectDocument[]).forEach((system) => {
        const normalizedSystem = normalizeProjectDocument(system);
        const updatedSystem: ProjectDocument = {
          ...normalizedSystem,
          meta: {
            ...normalizedSystem.meta,
            projectCode: normalizedGroup.projectCode,
            projectName: normalizedGroup.projectName,
            unitName: normalizedGroup.unitName,
            reportDate: normalizedGroup.reportDate,
          },
          updatedAt: Date.now(),
        };
        projectsStore.put(updatedSystem);
        summariesStore.put(toProjectSummary(updatedSystem));
      });
    };
    matchingSystems.onerror = () => reject(matchingSystems.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'updateProjectGroupAndSystems', DB_DOC_TIMEOUT_MS));
}

export async function loadProject(projectId: string): Promise<ProjectDocument | null> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return withTimeout(new Promise<ProjectDocument | null>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE_NAME).get(projectId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ? normalizeProjectDocument(request.result) : null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  }), 'loadProject', DB_DOC_TIMEOUT_MS);
}

export async function loadProjectGroup(groupId: string): Promise<ProjectGroup | null> {
  const db = await openDB();
  return withTimeout(new Promise<ProjectGroup | null>((resolve, reject) => {
    const tx = db.transaction(PROJECT_GROUPS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECT_GROUPS_STORE_NAME).get(groupId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ? normalizeProjectGroup(request.result) : null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  }), 'loadProjectGroup');
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECTS_STORE_NAME).delete(projectId);
    tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).delete(projectId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'deleteProject', DB_DOC_TIMEOUT_MS));
}

export async function deleteProjectGroup(groupId: string): Promise<void> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).delete(groupId);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    const matchingSystems = projectsStore.index('groupId').getAllKeys(groupId);
    matchingSystems.onsuccess = () => {
      (matchingSystems.result as IDBValidKey[]).forEach((systemId) => {
        projectsStore.delete(systemId);
        summariesStore.delete(systemId);
      });
    };
    matchingSystems.onerror = () => reject(matchingSystems.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'deleteProjectGroup', DB_DOC_TIMEOUT_MS));
}

async function migrateLegacyProjectIfNeeded(): Promise<void> {
  const db = await openDB();
  return withTimeout(new Promise<void>((resolve, reject) => {
    if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      db.close();
      resolve();
      return;
    }
    const tx = db.transaction([LEGACY_STORE_NAME, PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME], 'readwrite');
    const legacyStore = tx.objectStore(LEGACY_STORE_NAME);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    const countRequest = projectsStore.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > 0) return;
      const legacyRequest = legacyStore.get(LEGACY_PROJECT_ID);
      legacyRequest.onsuccess = () => {
        if (!legacyRequest.result) return;
        const migrated = normalizeProjectDocument({ ...legacyRequest.result, id: LEGACY_PROJECT_ID, groupId: null });
        projectsStore.put(migrated);
        summariesStore.put(toProjectSummary(migrated));
      };
      legacyRequest.onerror = () => reject(legacyRequest.error);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'migrateLegacyProjectIfNeeded', DB_DOC_TIMEOUT_MS);
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
  // 未分组的独立系统各自成为一行，避免多个互不相关的单系统被合并成一个“未分组/单系统项目”伪分组。
  ungrouped.forEach((system) => {
    summaries.push({ id: system.id, group: null, systems: [system] });
  });
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

/** 从摘要 store 读出的记录做一次防御性归一（补默认 meta / groupId / 计数），兼容旧记录。 */
function normalizeSummary(summary: Partial<ProjectSummary> & { id: string }): ProjectSummary {
  const now = Date.now();
  return {
    id: summary.id,
    groupId: typeof summary.groupId === 'string' && summary.groupId.trim() ? summary.groupId : null,
    meta: normalizeMeta(summary.meta),
    assetCount: typeof summary.assetCount === 'number' && summary.assetCount >= 0 ? summary.assetCount : 0,
    createdAt: summary.createdAt || summary.updatedAt || now,
    updatedAt: summary.updatedAt || now,
  };
}

/** 直接从未归一的原始文档记录派生摘要，不深拷贝 assets（仅取张数），供升级回填逐条游标使用。 */
function summaryFromRaw(raw: Partial<ProjectDocument> & { id: string }): ProjectSummary {
  const now = Date.now();
  return {
    id: raw.id,
    groupId: typeof raw.groupId === 'string' && raw.groupId.trim() ? raw.groupId : null,
    meta: normalizeMeta(raw.meta),
    assetCount: Array.isArray(raw.assets) ? raw.assets.length : 0,
    createdAt: raw.createdAt || raw.updatedAt || now,
    updatedAt: raw.updatedAt || now,
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
