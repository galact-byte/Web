/**
 * 持久存储（navigator.storage.persist）：批准后浏览器在磁盘紧张时不会自动清除本站数据。
 * Chrome/Edge 不弹权限框，是否批准由浏览器按站点使用情况决定（安装为应用、加书签、常用更容易批准），
 * 新用户资料下通常静默拒绝（research/quota.md）。界面必须如实显示结果，不能宣称已受保护。
 */

export type PersistenceState = 'granted' | 'denied' | 'unsupported';

function storageManager(): StorageManager | null {
  return typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;
}

/** 只查询，不申请。 */
export async function getPersistenceState(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** 已批准直接返回；否则申请一次并返回结果。启动时调用一次，不自动反复申请。 */
export async function requestPersistence(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return 'unsupported';
  try {
    if (await storage.persisted()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
