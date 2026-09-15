import { setTimeout as delay } from 'node:timers/promises';

export async function connectBrowser(port, matches = target => target.type === 'page' && /^(file|http):/.test(target.url)) {
  let target;
  for (let n = 0; n < 100; n++) {
    try { target = (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) }).then(r => r.json())).find(matches); } catch { /* 等待测试进程。 */ }
    if (target) break;
    await delay(100);
  }
  if (!target) throw new Error('无法连接隔离浏览器');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  socket.addEventListener('close', () => { for (const request of pending.values()) request.reject(new Error('测试浏览器连接已关闭')); pending.clear(); });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('测试浏览器已断连')); return; }
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`浏览器命令超时：${method}`)); }, 30000);
    pending.set(requestId, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  return { send, close: () => socket.close(), evaluate: async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  } };
}
