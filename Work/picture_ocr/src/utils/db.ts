import type {
  Asset,
  Category,
  ImageData,
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
import {
  IMAGES_PROJECT_INDEX,
  IMAGES_STORE_NAME,
  buildStoredImage,
  collectImageRefs,
  collectInlineImages,
  imageRecordKey,
  planImageReconcile,
  planMigrationTargets,
  stripInlineImageData,
  type ImageReconcilePlan,
  type MigrationState,
  type StoredImage,
} from './imageStore';

const DB_NAME = 'evidence-collector-db';
const DB_VERSION = 5;
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
        // v4 → v5：只创建空的图片字节 store，存量内联图片的搬迁延后到 migrateInlineImages()。
        if (!db.objectStoreNames.contains(IMAGES_STORE_NAME)) {
          const imagesStore = db.createObjectStore(IMAGES_STORE_NAME, { keyPath: 'key' });
          imagesStore.createIndex(IMAGES_PROJECT_INDEX, 'projectId', { unique: false });
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
          result.damagedRecords.push({
            projectId: String(key),
            reason: 'invalid-value',
            valueType: raw === null ? 'null' : typeof raw,
          });
        }
        repairNext(queue, index + 1);
      };
      getRequest.onerror = (event) => {
        // 单条记录读失败（值已损坏）不能中止整个事务，否则一条坏记录会让其余修复全部回滚。
        event.preventDefault();
        event.stopPropagation();
        result.damagedIds.push(String(key));
        result.damagedRecords.push({
          projectId: String(key),
          reason: 'read-error',
          errorName: getRequest.error?.name ?? null,
          errorMessage: getRequest.error?.message ?? null,
        });
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
  /** images store 里的图片字节条数。 */
  images: number;
  /** 旧版单项目记录仍在 legacy store，且从未迁移进 projects store。 */
  legacyStranded: boolean;
}

export async function getStoreDiagnostics(): Promise<StoreDiagnostics> {
  const db = await openDB();
  return withTimeout(new Promise<StoreDiagnostics>((resolve, reject) => {
    const result: StoreDiagnostics = { projects: 0, summaries: 0, groups: 0, legacy: 0, images: 0, legacyStranded: false };
    const names = [PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, PROJECT_GROUPS_STORE_NAME, LEGACY_STORE_NAME, IMAGES_STORE_NAME]
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
    countInto(IMAGES_STORE_NAME, (value) => { result.images = value; });
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

/** 同事务内清理某个项目的全部图片字节，避免项目删了而几百 MB 字节永久残留。 */
function deleteImagesOfProject(imagesStore: IDBObjectStore, projectId: string): void {
  const keysRequest = imagesStore.index(IMAGES_PROJECT_INDEX).getAllKeys(projectId);
  keysRequest.onsuccess = () => {
    (keysRequest.result as IDBValidKey[]).forEach((key) => imagesStore.delete(key));
  };
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECTS_STORE_NAME).delete(projectId);
    tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).delete(projectId);
    deleteImagesOfProject(tx.objectStore(IMAGES_STORE_NAME), projectId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'deleteProject', DB_DOC_TIMEOUT_MS));
}

export async function deleteProjectGroup(groupId: string): Promise<void> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECT_GROUPS_STORE_NAME, PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    tx.objectStore(PROJECT_GROUPS_STORE_NAME).delete(groupId);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const summariesStore = tx.objectStore(PROJECT_SUMMARIES_STORE_NAME);
    const imagesStore = tx.objectStore(IMAGES_STORE_NAME);
    const matchingSystems = projectsStore.index('groupId').getAllKeys(groupId);
    matchingSystems.onsuccess = () => {
      (matchingSystems.result as IDBValidKey[]).forEach((systemId) => {
        projectsStore.delete(systemId);
        summariesStore.delete(systemId);
        deleteImagesOfProject(imagesStore, String(systemId));
      });
    };
    matchingSystems.onerror = () => reject(matchingSystems.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'deleteProjectGroup', DB_DOC_TIMEOUT_MS));
}

// ---------- 图片字节独立存储（v5） ----------

/** 读一张图片的字节：未迁移的内联图直接用，已迁移的按主键去 images store 取。 */
export async function resolveImageData(projectId: string, image: ImageData): Promise<string | null> {
  if (typeof image.data === 'string' && image.data.length > 0) return image.data;
  const db = await openDB();
  return withTimeout(new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE_NAME, 'readonly');
    const request = tx.objectStore(IMAGES_STORE_NAME).get(imageRecordKey(projectId, image.id));
    request.onsuccess = () => {
      db.close();
      resolve((request.result as StoredImage | undefined)?.data ?? null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  }), 'resolveImageData');
}

/** 一次性取出某项目的全部图片字节（报告导出、数据包导出用），避免逐张开事务。 */
export async function resolveImagesForProject(projectId: string): Promise<Map<string, string>> {
  const db = await openDB();
  return withTimeout(new Promise<Map<string, string>>((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE_NAME, 'readonly');
    const request = tx.objectStore(IMAGES_STORE_NAME).index(IMAGES_PROJECT_INDEX).getAll(projectId);
    request.onsuccess = () => {
      const map = new Map<string, string>();
      for (const record of (request.result as StoredImage[]) ?? []) {
        if (record && typeof record.imageId === 'string' && typeof record.data === 'string') {
          map.set(record.imageId, record.data);
        }
      }
      db.close();
      resolve(map);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  }), 'resolveImagesForProject', DB_DOC_TIMEOUT_MS);
}

/**
 * 新增/替换一张图片：字节写 images store，文档只更新元数据引用。
 * 文档从库里现读现改（不接受调用方内存里的整份快照），因此手机上传与电脑端并发写不会互相覆盖。
 */
export async function addImageToProject(
  projectId: string,
  assetId: string,
  itemId: string,
  image: ImageData
): Promise<void> {
  const record = buildStoredImage(projectId, image);
  if (!record) throw new Error('图片没有内容，未写入');
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    let failure: Error | null = null;
    const docRequest = projectsStore.get(projectId);
    docRequest.onsuccess = () => {
      const raw = docRequest.result as ProjectDocument | undefined;
      if (!raw) {
        failure = new Error(`项目 ${projectId} 不存在，图片未保存`);
        tx.abort();
        return;
      }
      const doc = normalizeProjectDocument(raw);
      const item = doc.assets.find((asset) => asset.id === assetId)?.items.find((entry) => entry.id === itemId);
      if (!item) {
        failure = new Error('检查项已不存在，图片未保存');
        tx.abort();
        return;
      }
      const { data: _inline, ...reference } = image;
      const ref = reference as ImageData;
      const existingIndex = item.images.findIndex((entry) => entry.id === image.id);
      if (existingIndex >= 0) item.images[existingIndex] = ref;
      else item.images.push(ref);
      doc.updatedAt = Date.now();
      tx.objectStore(IMAGES_STORE_NAME).put(record);
      projectsStore.put(doc);
      tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).put(toProjectSummary(doc));
    };
    docRequest.onerror = () => { failure = docRequest.error ?? new Error('读取项目失败'); };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('图片保存事务已中止')); };
    tx.onerror = () => { db.close(); reject(failure ?? tx.error); };
  }), 'addImageToProject', DB_DOC_TIMEOUT_MS));
}

/** 删除一张图片：同事务去掉文档引用与 images store 里的字节。 */
export async function removeImageFromProject(
  projectId: string,
  assetId: string,
  itemId: string,
  imageId: string
): Promise<void> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    let failure: Error | null = null;
    const docRequest = projectsStore.get(projectId);
    docRequest.onsuccess = () => {
      const raw = docRequest.result as ProjectDocument | undefined;
      if (!raw) {
        failure = new Error(`项目 ${projectId} 不存在`);
        tx.abort();
        return;
      }
      const doc = normalizeProjectDocument(raw);
      const item = doc.assets.find((asset) => asset.id === assetId)?.items.find((entry) => entry.id === itemId);
      if (item) item.images = item.images.filter((entry) => entry.id !== imageId);
      doc.updatedAt = Date.now();
      tx.objectStore(IMAGES_STORE_NAME).delete(imageRecordKey(projectId, imageId));
      projectsStore.put(doc);
      tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).put(toProjectSummary(doc));
    };
    docRequest.onerror = () => { failure = docRequest.error ?? new Error('读取项目失败'); };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('图片删除事务已中止')); };
    tx.onerror = () => { db.close(); reject(failure ?? tx.error); };
  }), 'removeImageFromProject', DB_DOC_TIMEOUT_MS));
}

/** 对账：文档引用的图片 vs images store 实际存在的字节，报出缺失与孤儿。 */
export async function reconcileProjectImages(projectId: string): Promise<ImageReconcilePlan> {
  const db = await openDB();
  return withTimeout(new Promise<ImageReconcilePlan>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, IMAGES_STORE_NAME], 'readonly');
    const docRequest = tx.objectStore(PROJECTS_STORE_NAME).get(projectId);
    const keysRequest = tx.objectStore(IMAGES_STORE_NAME).index(IMAGES_PROJECT_INDEX).getAllKeys(projectId);
    tx.oncomplete = () => {
      db.close();
      const raw = docRequest.result as ProjectDocument | undefined;
      if (!raw) {
        resolve({ missing: [], orphans: [] });
        return;
      }
      // 未迁移的内联图片字节就在文档里，不算缺失。
      const inlineIds = new Set(collectInlineImages(raw).map((entry) => entry.image.id));
      const plan = planImageReconcile(projectId, collectImageRefs(raw), (keysRequest.result as IDBValidKey[]) ?? []);
      resolve({
        missing: plan.missing.filter((id) => !inlineIds.has(id)),
        orphans: plan.orphans,
      });
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'reconcileProjectImages');
}

const MIGRATION_STATE_KEY = 'evidence-image-migration-v5';

function readMigrationState(): MigrationState {
  try {
    const raw = localStorage.getItem(MIGRATION_STATE_KEY);
    if (!raw) return { completedIds: [], damagedIds: [] };
    const parsed = JSON.parse(raw) as Partial<MigrationState>;
    return {
      completedIds: Array.isArray(parsed?.completedIds) ? parsed.completedIds.map(String) : [],
      damagedIds: Array.isArray(parsed?.damagedIds) ? parsed.damagedIds.map(String) : [],
    };
  } catch {
    return { completedIds: [], damagedIds: [] };
  }
}

function writeMigrationState(state: MigrationState): void {
  try {
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
  } catch {
    // 写不进（隐私模式/配额）只会导致下次重新扫描，不影响正确性。
  }
}

async function listProjectKeys(): Promise<string[]> {
  const db = await openDB();
  return withTimeout(new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE_NAME).getAllKeys();
    request.onsuccess = () => { db.close(); resolve(((request.result as IDBValidKey[]) ?? []).map(String)); };
    request.onerror = () => { db.close(); reject(request.error); };
  }), 'listProjectKeys');
}

/**
 * 搬迁单个项目的内联图片：同一事务内「写字节 → 读回校验 → 通过后才剥离文档里的 data」。
 * 任何一步失败都 abort，该项目原样保留内联字节，绝不会出现「字节没写成却把 data 删了」。
 */
async function migrateProjectImages(projectId: string): Promise<boolean> {
  const db = await openDB();
  return trackWrite(withTimeout(new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const imagesStore = tx.objectStore(IMAGES_STORE_NAME);
    let migrated = false;
    let failure: Error | null = null;
    const docRequest = projectsStore.get(projectId);
    docRequest.onsuccess = () => {
      const raw = docRequest.result as ProjectDocument | undefined;
      if (!raw) return; // 项目已删除，无需搬迁
      const inline = collectInlineImages(raw);
      if (inline.length === 0) return; // 已是引用形态

      const verified = new Set<string>();
      let pending = inline.length;
      const finish = () => {
        if (verified.size !== inline.length) {
          failure = new Error(`项目 ${projectId} 有 ${inline.length - verified.size} 张图片写入后未通过校验`);
          tx.abort();
          return;
        }
        const strippedDoc = stripInlineImageData(raw, verified);
        const normalized = normalizeProjectDocument(strippedDoc);
        projectsStore.put(normalized);
        tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).put(toProjectSummary(normalized));
        migrated = true;
      };
      for (const entry of inline) {
        const record = buildStoredImage(projectId, entry.image);
        if (!record) {
          pending -= 1;
          continue;
        }
        imagesStore.put(record);
        // 读回校验：字节确实落库了才允许剥离原始 data。
        const readBack = imagesStore.get(record.key);
        readBack.onsuccess = () => {
          const stored = readBack.result as StoredImage | undefined;
          if (stored && stored.data === record.data) verified.add(entry.image.id);
          pending -= 1;
          if (pending === 0) finish();
        };
        readBack.onerror = () => {
          pending -= 1;
          if (pending === 0) finish();
        };
      }
      if (pending === 0) finish();
    };
    docRequest.onerror = () => { failure = docRequest.error ?? new Error('读取项目失败'); };
    tx.oncomplete = () => { db.close(); resolve(migrated); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('图片搬迁事务已中止')); };
    tx.onerror = () => { db.close(); reject(failure ?? tx.error); };
  }), 'migrateProjectImages', DB_DOC_TIMEOUT_MS));
}

/**
 * 把引用形态文档补齐成内联形态（导出报告、导出数据包、批量压缩用）。
 * 结果只在内存中使用，不写回库，避免把字节又塞回文档。
 */
export async function hydrateAssets(projectId: string, assets: Asset[]): Promise<Asset[]> {
  const needsBytes = assets.some((asset) =>
    asset.items.some((item) => item.images.some((image) => typeof image.data !== 'string' || image.data.length === 0))
  );
  if (!needsBytes) return assets; // 全部尚未迁移，无需补齐
  const bytes = await resolveImagesForProject(projectId);
  return assets.map((asset) => ({
    ...asset,
    items: asset.items.map((item) => ({
      ...item,
      images: item.images.map((image) => {
        if (typeof image.data === 'string' && image.data.length > 0) return image;
        const data = bytes.get(image.id);
        return data ? { ...image, data } : image;
      }),
    })),
  }));
}

export async function hydrateProjectImages(doc: ProjectDocument): Promise<ProjectDocument> {
  return { ...doc, assets: await hydrateAssets(doc.id, doc.assets) };
}

/**
 * 保存一份可能含内联字节的文档（数据包导入、批量压缩回写等外部来源）：
 * 同事务把字节拆进 images store，库里的文档只留引用，不会把上百 MB 的 Base64 写回项目文档。
 */
export async function saveProjectWithImages(doc: ProjectDocument): Promise<void> {
  const inline = collectInlineImages(doc);
  if (inline.length === 0) return saveProject(doc);

  const records: StoredImage[] = [];
  const migratedIds = new Set<string>();
  for (const entry of inline) {
    const record = buildStoredImage(doc.id, entry.image);
    if (!record) continue;
    records.push(record);
    migratedIds.add(entry.image.id);
  }
  const stripped = normalizeProjectDocument(stripInlineImageData(doc, migratedIds));

  const db = await openDB();
  return trackWrite(withTimeout(new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE_NAME, PROJECT_SUMMARIES_STORE_NAME, IMAGES_STORE_NAME], 'readwrite');
    const imagesStore = tx.objectStore(IMAGES_STORE_NAME);
    for (const record of records) imagesStore.put(record);
    tx.objectStore(PROJECTS_STORE_NAME).put(stripped);
    tx.objectStore(PROJECT_SUMMARIES_STORE_NAME).put(toProjectSummary(stripped));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('保存事务已中止')); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }), 'saveProjectWithImages', DB_DOC_TIMEOUT_MS));
}

/**
 * 打开项目前的单项目搬迁：保证内存里的文档是轻量引用形态，后续每次自动保存只写 KB 级文档。
 * 搬迁失败不阻塞打开：文档保持内联形态仍可正常使用（只是没享受到性能改善）。
 */
export async function ensureProjectImagesMigrated(projectId: string): Promise<boolean> {
  try {
    return await migrateProjectImages(projectId);
  } catch (error) {
    recordError({
      type: 'manual',
      message: `项目 ${projectId} 的图片搬迁未完成，已保持原有存储形态：${error instanceof Error ? error.message : String(error)}`,
      context: 'db:ensureProjectImagesMigrated',
    });
    return false;
  }
}

export interface ImageMigrationReport {
  /** 本轮检查过的项目数。 */
  scanned: number;
  /** 实际发生搬迁的项目数。 */
  migrated: number;
  /** 搬迁失败、保持内联形态的项目。 */
  damagedIds: string[];
  /** 是否已把待办项目全部处理完。 */
  done: boolean;
}

export interface ImageMigrationProgress {
  /** 库里的系统总数。 */
  total: number;
  /** 已完成搬迁检查的系统数。 */
  completed: number;
  /** 搬迁失败、仍保持内联形态的系统数。 */
  damaged: number;
  /** 还没处理的系统数。 */
  pending: number;
}

/** 给存储面板用的搬迁进度（不触发搬迁，只读状态）。 */
export async function getImageMigrationProgress(): Promise<ImageMigrationProgress> {
  const state = readMigrationState();
  const keys = await listProjectKeys();
  const known = new Set(keys);
  const completed = state.completedIds.filter((id) => known.has(id)).length;
  const damaged = state.damagedIds.filter((id) => known.has(id)).length;
  const pending = planMigrationTargets(keys, state).length;
  return { total: keys.length, completed, damaged, pending };
}

let migrationRunning = false;

/**
 * 存量内联图片搬迁：按项目逐个处理，每个项目一个事务，处理完立刻落盘进度。
 * 中途强制退出最多损失当前这一个项目的进度（数据仍是完好的内联形态），重启后从断点继续。
 */
export async function migrateInlineImages(
  force = false,
  onProgress?: (done: number, total: number) => void
): Promise<ImageMigrationReport> {
  const report: ImageMigrationReport = { scanned: 0, migrated: 0, damagedIds: [], done: false };
  if (migrationRunning) return report;
  migrationRunning = true;
  try {
    const state = readMigrationState();
    if (force) state.damagedIds = [];
    const targets = planMigrationTargets(await listProjectKeys(), state);
    onProgress?.(0, targets.length);
    for (const projectId of targets) {
      report.scanned += 1;
      try {
        if (await migrateProjectImages(projectId)) report.migrated += 1;
        state.completedIds.push(projectId);
      } catch (error) {
        // 单个项目失败不影响其余：该项目保持内联形态照常可用，只是暂时享受不到性能改善。
        state.damagedIds.push(projectId);
        report.damagedIds.push(projectId);
        recordError({
          type: 'manual',
          message: `项目 ${projectId} 的图片搬迁失败，已保持原样：${error instanceof Error ? error.message : String(error)}`,
          context: 'db:migrateInlineImages',
        });
      }
      writeMigrationState(state);
      onProgress?.(report.scanned, targets.length);
    }
    report.done = true;
  } finally {
    migrationRunning = false;
  }
  return report;
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
