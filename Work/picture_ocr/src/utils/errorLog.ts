import { getDamagedProjectDiagnostics, getLastSummaryRepairReport, getStoreDiagnostics, listDiagnosticProjectGroups, type DamagedProjectDiagnostics, type StoreDiagnostics } from './db';
import type { SummaryRepairReport } from './summaryRepair';
import { getStorageEstimate } from './storageEstimate';

/** 单条错误记录 */
export interface ErrorLogEntry {
  time: string; // ISO
  type: 'error' | 'unhandledrejection' | 'manual';
  message: string;
  stack?: string;
  context?: string;
}

const STORAGE_KEY = 'evidence-error-log';
const MAX_ENTRIES = 50;
const DEDUP_WINDOW_MS = 3000;

let lastSignature = '';
let lastRecordedAt = 0;
let notifier: ((message: string) => void) | null = null;

function appVersion(): string {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
  } catch {
    return 'unknown';
  }
}

function safeParse(raw: string | null): ErrorLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function getErrorLog(): ErrorLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function clearErrorLog(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略：清空失败不影响主流程
  }
}

/** 记录一条错误。相同 message 在去重窗口内只记一次，避免刷屏。 */
export function recordError(entry: Omit<ErrorLogEntry, 'time'>): void {
  const now = Date.now();
  const signature = `${entry.type}:${entry.message}`;
  if (signature === lastSignature && now - lastRecordedAt < DEDUP_WINDOW_MS) return;
  lastSignature = signature;
  lastRecordedAt = now;

  const full: ErrorLogEntry = { time: new Date().toISOString(), ...entry };
  if (typeof localStorage !== 'undefined') {
    try {
      const next = [full, ...getErrorLog()].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略：localStorage 写入失败（如隐私模式）不应再抛错造成循环
    }
  }
}

/**
 * 记录并同时提示用户。用于「静默失败会直接丢数据」的关键路径（如项目自动保存）：
 * 以前保存失败只写 console，用户看不到，刚拍的照片只存在内存里，关闭就没了。
 */
export function reportCriticalError(entry: Omit<ErrorLogEntry, 'time'>): void {
  recordError(entry);
  notifyUi(entry.message);
}

function notifyUi(message: string): void {
  if (!notifier) return;
  try {
    notifier(message);
  } catch {
    // 忽略：通知回调异常不应影响记录
  }
}

/** 安装全局错误捕获。notify 用于把错误冒泡给 UI（如 Toast）。可重复调用（只装一次）。 */
let installed = false;
export function installGlobalErrorHandlers(notify?: (message: string) => void): void {
  if (notify) notifier = notify;
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // 资源加载错误（img/script）没有 message，弱化记录，避免噪声。
    const message = event.message || (event.error instanceof Error ? event.error.message : '') || '未知脚本错误';
    recordError({
      type: 'error',
      message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: event.filename ? `${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}` : undefined,
    });
    notifyUi(message);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '未处理的 Promise 拒绝';
    recordError({
      type: 'unhandledrejection',
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    notifyUi(message);
  });
}

/** 设置/更新 UI 通知回调（ToastProvider 在 App 内，故 main 先装 handler，App 挂载后再补回调）。 */
export function setErrorNotifier(notify: (message: string) => void): void {
  notifier = notify;
}

/** 诊断报告：环境 + 数据规模 + 最近错误，供导出给开发者定位。 */
export interface DiagnosticsReport {
  app: string;
  generatedAt: string;
  userAgent: string;
  platform: 'desktop' | 'web';
  storage: { supported: boolean; usage: number | null; quota: number | null };
  counts: { groups: number; systems: number; assets: number };
  /** 各 store 的真实条数：与 counts 对不上就说明有项目在库里但没进列表。 */
  stores: StoreDiagnostics | null;
  /** 最近一次存储自检修复结果（含无法读取的记录主键）。 */
  repair: SummaryRepairReport | null;
  /** 关联图片仅计数，不代表字节有效或可恢复。 */
  damagedProjects?: DamagedProjectDiagnostics[];
  /** 项目清单（不含图片字节），便于和用户描述的「少了哪个」逐条比对。 */
  projects: Array<{
    id: string;
    groupId: string | null;
    projectName: string;
    systemName: string;
    assetCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  errors: ErrorLogEntry[];
}

export async function buildDiagnosticsReport(): Promise<DiagnosticsReport> {
  const desktop = typeof window !== 'undefined' && !!window.evidenceData;
  let counts = { groups: 0, systems: 0, assets: 0 };
  let projects: DiagnosticsReport['projects'] = [];
  try {
    const groups = await listDiagnosticProjectGroups();
    const systems = groups.flatMap((group) => group.systems);
    counts = {
      groups: groups.length,
      systems: systems.length,
      assets: systems.reduce((sum, system) => sum + (system.assetCount ?? 0), 0),
    };
    projects = systems.map((system) => ({
      id: system.id,
      groupId: system.groupId,
      projectName: system.meta.projectName,
      systemName: system.meta.systemName,
      assetCount: system.assetCount,
      createdAt: new Date(system.createdAt).toISOString(),
      updatedAt: new Date(system.updatedAt).toISOString(),
    }));
  } catch (err) {
    recordError({ type: 'manual', message: `诊断读取项目计数失败：${err instanceof Error ? err.message : String(err)}` });
  }

  let stores: StoreDiagnostics | null = null;
  try {
    stores = await getStoreDiagnostics();
  } catch (err) {
    recordError({ type: 'manual', message: `诊断读取存储条数失败：${err instanceof Error ? err.message : String(err)}` });
  }

  let storage: DiagnosticsReport['storage'] = { supported: false, usage: null, quota: null };
  try {
    const estimate = await getStorageEstimate();
    storage = { supported: estimate.supported, usage: estimate.usage ?? null, quota: estimate.quota ?? null };
  } catch {
    // 忽略：估算失败保持默认
  }

  const repair = getLastSummaryRepairReport();
  const damagedProjects = await getDamagedProjectDiagnostics(repair?.damagedIds ?? []);
  return {
    app: appVersion(),
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: desktop ? 'desktop' : 'web',
    storage,
    counts,
    stores,
    repair,
    damagedProjects,
    projects,
    errors: getErrorLog(),
  };
}

/** 导出诊断包为 JSON 文件：统一走普通 <a download>，保存位置交给浏览器。 */
export async function downloadDiagnostics(): Promise<void> {
  const report = await buildDiagnosticsReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `诊断包-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 延迟释放，兼容部分浏览器点击后仍在读取 URL。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
