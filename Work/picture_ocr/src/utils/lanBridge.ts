export interface LanCollectorItemSnapshot {
  id: string;
  label: string;
  required: boolean;
  imageCount: number;
}

export interface LanCollectorSnapshot {
  projectId: string;
  title: string;
  categories: Array<{ id: string; name: string }>;
  assets: Array<{
    id: string;
    name: string;
    categoryId: string;
    items: LanCollectorItemSnapshot[];
  }>;
}

export interface LanImageUpload {
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
  confirmImageSaved: (requestId: string, outcome: { success: boolean; message?: string }) => void;
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

function isLocalHost(): boolean {
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '::1';
}

async function requestControl<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${CONTROL_API}${path}`, {
    cache: 'no-store',
    ...options,
    headers: { 'x-evidence-control': '1', ...options?.headers },
  });
  const result = await response.json().catch(() => ({ message: '局域网采集服务返回了无效响应。' })) as T & { message?: string };
  if (!response.ok) throw new Error(result.message || '局域网采集服务请求失败。');
  return result;
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

function confirmWebImage(requestId: string, outcome: { success: boolean; message?: string }): void {
  void requestControl('/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ requestId, ...outcome }),
  }).then(() => {
    clearConfirmation(requestId);
    schedulePoll();
  }).catch(() => {
    if (!confirmationTimers.has(requestId)) return;
    const timer = window.setTimeout(() => confirmWebImage(requestId, outcome), 1500);
    confirmationTimers.set(requestId, timer);
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
  try {
    const pending = await requestControl<ControlPendingResponse>('/pending');
    if (pending.upload && !pollingRequestIds.has(pending.upload.requestId)) {
      pollingRequestIds.add(pending.upload.requestId);
      for (const listener of pollListeners) listener(pending.upload);
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
    return requestControl<LanSessionStatus>('/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ snapshot, selectedAddress }),
    });
  },
  async stopSession() {
    clearAllConfirmations();
    pollingRequestIds.clear();
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
    const previousTimer = confirmationTimers.get(requestId);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    confirmationTimers.set(requestId, 0);
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
