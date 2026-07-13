export type ReadinessState = 'checking' | 'ready' | 'unavailable';

export interface PwaReadiness {
  secureContext: boolean;
  webCrypto: boolean;
  indexedDb: ReadinessState;
  serviceWorker: ReadinessState;
  installState: 'installable' | 'installed' | 'manual' | 'unavailable';
  offlineReason: string | null;
}

type PwaListener = (readiness: PwaReadiness) => void;

let initialization: Promise<void> | null = null;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<PwaListener>();
let readiness = createInitialReadiness();

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function isLocalhost(): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function getOfflineReason(): string | null {
  if (import.meta.env.DEV) return '开发环境不注册离线缓存。';
  if (window.location.protocol === 'file:') return 'Electron 或 file:// 本地文件模式不支持 PWA 离线准备。';
  if (window.location.protocol === 'http:' && !isLocalhost()) return '普通 HTTP 地址不支持 PWA 离线准备，请改用 HTTPS。';
  if (!window.isSecureContext) return '需要通过 HTTPS 或 localhost 打开页面，才能准备离线缓存。';
  if (window.location.protocol !== 'https:' && !isLocalhost()) return '当前地址不支持 PWA 离线准备。';
  if (!('serviceWorker' in navigator)) return '当前浏览器不支持 Service Worker，无法准备离线缓存。';
  if (!('caches' in window)) return '当前浏览器不支持 Cache Storage，无法准备离线缓存。';
  return null;
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function createInitialReadiness(): PwaReadiness {
  const offlineReason = getOfflineReason();
  return {
    secureContext: window.isSecureContext,
    webCrypto: Boolean(globalThis.crypto?.subtle && globalThis.crypto.getRandomValues),
    indexedDb: 'checking',
    serviceWorker: offlineReason ? 'unavailable' : 'checking',
    installState: isInstalled() ? 'installed' : 'unavailable',
    offlineReason,
  };
}

function notify(): void {
  listeners.forEach((listener) => listener(readiness));
}

function updateReadiness(next: Partial<PwaReadiness>): void {
  readiness = { ...readiness, ...next };
  notify();
}

async function checkIndexedDb(): Promise<void> {
  if (!('indexedDB' in window)) {
    updateReadiness({ indexedDb: 'unavailable' });
    return;
  }

  const databaseName = `picture-ocr-pwa-check-${Date.now()}`;
  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('check');
      request.onsuccess = () => {
        request.result.close();
        const deleteRequest = indexedDB.deleteDatabase(databaseName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => reject(new Error('IndexedDB 删除检查被阻塞'));
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB 打开检查被阻塞'));
    });
    updateReadiness({ indexedDb: 'ready' });
  } catch {
    updateReadiness({ indexedDb: 'unavailable' });
  }
}

async function registerServiceWorker(): Promise<void> {
  if (readiness.offlineReason) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    const cacheKeys = await caches.keys();
    const hasPictureOcrCache = cacheKeys.some((key) => key.startsWith('picture-ocr-static-'));
    updateReadiness({ serviceWorker: hasPictureOcrCache ? 'ready' : 'checking' });

    registration.update().catch(() => {
      // 更新检查失败不影响已激活版本的离线可用性。
    });
  } catch {
    updateReadiness({
      serviceWorker: 'unavailable',
      offlineReason: '离线缓存注册失败，请检查 HTTPS、浏览器权限或站点存储设置。',
    });
  }
}

function setupInstallEvents(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    updateReadiness({ installState: 'installable' });
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateReadiness({ installState: 'installed' });
  });

  if (!isInstalled() && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    updateReadiness({ installState: 'manual' });
  }
}

/** 仅在生产 HTTPS/localhost 环境注册；不会读取、缓存或处理用户数据。 */
export function initializePwa(): Promise<void> {
  initialization ??= (async () => {
    setupInstallEvents();
    await Promise.all([checkIndexedDb(), registerServiceWorker()]);
  })();
  return initialization;
}

export function getPwaReadiness(): PwaReadiness {
  return readiness;
}

export function subscribePwaReadiness(listener: PwaListener): () => void {
  listeners.add(listener);
  listener(readiness);
  return () => listeners.delete(listener);
}

export async function requestPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    return true;
  } finally {
    deferredInstallPrompt = null;
    if (!isInstalled()) updateReadiness({ installState: 'unavailable' });
  }
}
