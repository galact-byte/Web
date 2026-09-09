// 未完成写入追踪：IndexedDB 的写是异步的，页面/窗口一旦销毁，未提交的事务会被中止，
// 刚拍的照片就静默消失。这里统一记账，供 beforeunload 与 Electron 主进程在关闭前拦截。
// 注意：失败的写入也必须解除占用，否则会永久阻止用户关窗。

let pendingCount = 0;
const listeners = new Set<(pending: number) => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(pendingCount);
    } catch {
      // 单个订阅者异常不影响记账本身
    }
  }
}

/** 把一次写入纳入统计，原样透传结果与异常。 */
export function trackWrite<T>(promise: Promise<T>): Promise<T> {
  pendingCount += 1;
  notify();
  return promise.finally(() => {
    pendingCount = Math.max(0, pendingCount - 1);
    notify();
  });
}

export function hasPendingWrites(): boolean {
  return pendingCount > 0;
}

export function getPendingWriteCount(): number {
  return pendingCount;
}

export function subscribePendingWrites(listener: (pending: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 关窗拦截：有未完成写入时阻止页面卸载，并把状态同步给桌面端主进程（网页端无该桥，自动降级为仅 beforeunload）。
 * Electron 下浏览器级 beforeunload 不会弹确认框，所以必须靠主进程的 close 拦截兼容。
 */
export function installUnloadGuard(): void {
  if (typeof window === 'undefined') return;

  const syncDesktop = (pending: number) => {
    try {
      window.evidenceWrites?.setPendingWrites(pending);
    } catch {
      // 桌面桥不可用时不影响网页端拦截
    }
  };
  subscribePendingWrites(syncDesktop);
  syncDesktop(pendingCount);

  window.addEventListener('beforeunload', (event) => {
    if (!hasPendingWrites()) return;
    event.preventDefault();
    event.returnValue = '正在保存刚刚的修改，现在关闭会丢失。';
  });
}
