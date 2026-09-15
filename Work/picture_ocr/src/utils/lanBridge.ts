import { requestJson } from './asyncDeadline';

export interface LanSaveOutcome { success: boolean; message?: string; sessionId?: string; attempt?: number }

export interface LanCollectorItemSnapshot {
  id: string;
  label: string;
  required: boolean;
  imageCount: number;
}

export interface LanCollectorAssetSnapshot {
  id: string;
  name: string;
  categoryId: string;
  items: LanCollectorItemSnapshot[];
}

/** 组快照中的单个系统结构（不含图片 data，仅结构与计数）。 */
export interface LanCollectorSystem {
  projectId: string;
  title: string;
  categories: Array<{ id: string; name: string }>;
  assets: LanCollectorAssetSnapshot[];
}

/** 项目组级采集快照：一次会话覆盖组内全部系统，手机端据此选系统。 */
export interface LanCollectorSnapshot {
  uploadRecovery?: number;
  groupId: string | null;
  groupTitle: string;
  systems: LanCollectorSystem[];
}

export interface LanImageUpload {
  sessionId?: string;
  attempt?: number;
  requestId: string;
  projectId: string;
  assetId: string;
  itemId: string;
  image: { fileName: string; data: string; mimeType: string };
}

export interface LanAddress {
  name: string;
  address: string;
}

export interface LanSessionStatus {
  running: boolean;
  url: string | null;
  addresses: LanAddress[];
}

export function prioritizeLanAddresses(addresses: LanAddress[]): LanAddress[] {
  const virtualAdapterPattern = /vmware|virtualbox|hyper-v|vethernet|docker|wsl|loopback|npcap|tunnel/i;
  return [...addresses].sort((left, right) => {
    const leftIsVirtual = virtualAdapterPattern.test(left.name);
    const rightIsVirtual = virtualAdapterPattern.test(right.name);
    if (leftIsVirtual !== rightIsVirtual) return leftIsVirtual ? 1 : -1;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

export interface LanBridge {
  startSession: (snapshot: LanCollectorSnapshot, selectedAddress?: string) => Promise<LanSessionStatus>;
  stopSession: () => Promise<LanSessionStatus>;
  updateSession: (snapshot: LanCollectorSnapshot) => Promise<LanSessionStatus>;
  getStatus: () => Promise<LanSessionStatus>;
  onImage: (listener: (upload: LanImageUpload) => void) => () => void;
  confirmImageSaved: (requestId: string, outcome: LanSaveOutcome) => void;
}

interface ControlPendingResponse {
  upload: LanImageUpload | null;
}

const CONTROL_API = '/api/control';
const pollListeners = new Set<(upload: LanImageUpload) => void>();
const pollingRequestIds = new Set<string>();
const confirmationTimers = new Map<string, number>();
let pollingTimer: number | null = null;
let pollInFlight = false;
let generation = 0;
let controlController = new AbortController();
const receivedGenerations = new Map<string, number>();
const uploadKey = (requestId: string, outcome: { sessionId?: string; attempt?: number }) => `${outcome.sessionId ?? ''}:${requestId}:${outcome.attempt ?? 0}`;
class ControlError extends Error { constructor(message: string, readonly status: number) { super(message); } }

function resetControl(): void {
  generation++;
  controlController.abort();
  controlController = new AbortController();
  clearAllConfirmations();
  pollingRequestIds.clear();
  receivedGenerations.clear();
}

function isLocalHost(): boolean {
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '::1';
}

async function requestControl<T>(path: string, options?: RequestInit): Promise<T> {
  const { response, data } = await requestJson(`${CONTROL_API}${path}`, {
    cache: 'no-store', ...options, headers: { 'x-evidence-control': '1', ...options?.headers },
  }, 8000, controlController.signal);
  if (!response.ok) throw new ControlError(typeof data.message === 'string' ? data.message : '局域网采集服务请求失败。', response.status);
  return data as T;
}

function stopPollingIfIdle(): void {
  if (pollListeners.size === 0 && pollingTimer !== null) {
    window.clearTimeout(pollingTimer);
    pollingTimer = null;
  }
}

function clearConfirmation(requestId: string): void {
  const timer = confirmationTimers.get(requestId);
  if (timer !== undefined) window.clearTimeout(timer);
  confirmationTimers.delete(requestId);
  pollingRequestIds.delete(requestId);
}

function clearAllConfirmations(): void {
  for (const requestId of confirmationTimers.keys()) clearConfirmation(requestId);
}

function confirmWebImage(requestId: string, outcome: LanSaveOutcome, epoch = generation): void {
  const key = uploadKey(requestId, outcome);
  if (epoch !== generation || receivedGenerations.get(key) !== epoch) return;
  void requestControl('/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ requestId, ...outcome }),
  }).then(() => {
    if (epoch !== generation) return;
    clearConfirmation(key);
    receivedGenerations.delete(key);
    schedulePoll();
  }).catch((error: unknown) => {
    if (epoch !== generation || !confirmationTimers.has(key)) return;
    if (error instanceof ControlError && [400, 401, 403, 404, 409].includes(error.status)) { clearConfirmation(key); receivedGenerations.delete(key); return; }
    const timer = window.setTimeout(() => confirmWebImage(requestId, outcome, epoch), 1500);
    confirmationTimers.set(key, timer);
  });
}

function schedulePoll(delay = 0): void {
  if (pollListeners.size === 0 || pollingTimer !== null) return;
  pollingTimer = window.setTimeout(() => {
    pollingTimer = null;
    void pollPendingImage();
  }, delay);
}

async function pollPendingImage(): Promise<void> {
  if (pollInFlight || pollListeners.size === 0) return;
  pollInFlight = true;
  const epoch = generation;
  try {
    const pending = await requestControl<ControlPendingResponse>('/pending');
    if (epoch !== generation) return;
    const upload = pending.upload;
    if (upload && typeof upload.requestId === 'string' && typeof upload.projectId === 'string'
      && typeof upload.assetId === 'string' && typeof upload.itemId === 'string' && typeof upload.image?.data === 'string') {
      const key = uploadKey(upload.requestId, upload);
      if (pollingRequestIds.has(key)) return;
      pollingRequestIds.add(key);
      receivedGenerations.set(key, epoch);
      for (const listener of pollListeners) listener(upload);
    }
  } catch {
    // 会话被停止或启动器退出时由下一次显式操作报告错误，轮询不打断工作台。
  } finally {
    pollInFlight = false;
    schedulePoll(700);
  }
}

const webBridge: LanBridge = {
  async startSession(snapshot, selectedAddress) {
    resetControl();
    return requestControl<LanSessionStatus>('/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ snapshot, selectedAddress }),
    });
  },
  async stopSession() {
    resetControl();
    return requestControl<LanSessionStatus>('/stop', { method: 'POST' });
  },
  updateSession(snapshot) {
    return requestControl<LanSessionStatus>('/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ snapshot }),
    });
  },
  getStatus() {
    return requestControl<LanSessionStatus>('/status');
  },
  onImage(listener) {
    pollListeners.add(listener);
    schedulePoll();
    return () => {
      pollListeners.delete(listener);
      stopPollingIfIdle();
    };
  },
  confirmImageSaved(requestId, outcome) {
    const key = uploadKey(requestId, outcome);
    if (receivedGenerations.get(key) !== generation) return;
    const previousTimer = confirmationTimers.get(key);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    confirmationTimers.set(key, 0);
    confirmWebImage(requestId, outcome);
  },
};

export function getNativeLanBridge(): LanBridge | null {
  return window.evidenceLan ?? null;
}

function serializeSessionLifecycle(bridge: LanBridge): LanBridge {
  let lifecycleQueue = Promise.resolve<void>(undefined);
  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = lifecycleQueue.catch(() => undefined).then(operation);
    lifecycleQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    startSession: (snapshot, selectedAddress) => enqueue(() => bridge.startSession(snapshot, selectedAddress)),
    stopSession: () => enqueue(() => bridge.stopSession()),
    updateSession: (snapshot) => enqueue(() => bridge.updateSession(snapshot)),
    getStatus: () => lifecycleQueue.catch(() => undefined).then(() => bridge.getStatus()),
    onImage: (listener) => bridge.onImage(listener),
    confirmImageSaved: (requestId, outcome) => bridge.confirmImageSaved(requestId, outcome),
  };
}

export async function detectLanBridge(): Promise<LanBridge | null> {
  const nativeBridge = getNativeLanBridge();
  if (nativeBridge) return serializeSessionLifecycle(nativeBridge);
  if (!isLocalHost()) return null;
  try {
    await webBridge.getStatus();
    return serializeSessionLifecycle(webBridge);
  } catch {
    return null;
  }
}
