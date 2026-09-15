/** 不可取消的浏览器 API 也要结束前台等待；迟到资源由创建方负责释放。 */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal, disposeLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let cancelled = signal.aborted;
    const abort = () => { cancelled = true; reject(signal.reason ?? new Error('操作已取消。')); };
    if (cancelled) abort();
    else signal.addEventListener('abort', abort, { once: true });
    promise.then(value => {
      signal.removeEventListener('abort', abort);
      if (cancelled) disposeLate?.(value);
      else resolve(value);
    }, error => { signal.removeEventListener('abort', abort); if (!cancelled) reject(error); });
  });
}

export async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, parent?: AbortSignal): Promise<T> {
  if (parent?.aborted) throw parent.reason ?? new Error('操作已取消。');
  const controller = new AbortController();
  const deadline = Date.now() + milliseconds;
  const expire = () => controller.abort(new Error('操作超时，请检查连接后重新核对。'));
  const resume = () => { if (Date.now() >= deadline) expire(); };
  const abort = () => controller.abort(parent?.reason ?? new Error('操作已取消。'));
  const timer = setTimeout(expire, milliseconds);
  parent?.addEventListener('abort', abort, { once: true });
  globalThis.document?.addEventListener('visibilitychange', resume);
  try {
    const result = await abortable(operation(controller.signal), controller.signal);
    resume();
    if (controller.signal.aborted) throw controller.signal.reason;
    return result;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
    globalThis.document?.removeEventListener('visibilitychange', resume);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function requestJson(url: string, options: RequestInit = {}, milliseconds = 8000, parent?: AbortSignal) {
  return withDeadline(async signal => {
    const response = await fetch(url, { ...options, signal });
    const data: unknown = await response.json();
    if (!isRecord(data)) throw new Error('服务返回了无效响应。');
    return { response, data };
  }, milliseconds, parent);
}
