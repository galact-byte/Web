import * as db from '../src/utils/db';
export { seed, startLan, stopLan, until, button } from './project-list-browser-cases.mjs';
export async function images(projectId = 'g1') {
  const doc = await db.loadProject(projectId);
  const images = doc.assets[0].items[0].images;
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('evidence-collector-db');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const count = await new Promise((resolve, reject) => {
    const request = database.transaction('images').objectStore('images').index('by_project').count(projectId);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  database.close();
  return { ids: images.map(image => image.id), count };
}
export function mobileInstrument() {
  const nativeFetch = window.fetch;
  const nativeTimer = window.setTimeout;
  window.lanFault = ''; window.uploadIds = [];
  // 仅缩短测试页面预算，生产常量不变；模拟移动端不具备本机控制权限。
  window.setTimeout = (fn, ms, ...args) => nativeTimer(fn, ms === 30000 ? 3000 : [8000, 15000, 45000].includes(ms) ? 700 : ms, ...args);
  window.fetch = async (input, options) => {
    const url = String(input);
    if (url.includes('/api/control/')) return new Response('{}', { status: 403 });
    if (url.includes('/api/upload?')) {
      window.uploadIds.push(new URL(url, location.href).searchParams.get('requestId'));
      if (window.lanFault === 'hang') return new Promise(() => {});
      if (window.lanFault === 'late') return new Promise(resolve => {
        window.finishUpload = () => resolve(new Response(JSON.stringify({ requestId: window.uploadIds.at(-1), state: 'saved' }), { status: 201 }));
      });
      const response = await nativeFetch(input, options);
      if (window.lanFault === 'lost') { await response.text(); throw new Error('测试：接收回执丢失'); }
      return response;
    }
    return nativeFetch(input, options);
  };
}
export function sendFile() {
  const transfer = new DataTransfer();
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
  transfer.items.add(new File([bytes], '保留原图.png', { type: 'image/png' }));
  const input = document.querySelector('input[type="file"]');
  input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
}
export function failWrites(fail) {
  window.originalTransaction ??= IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = fail ? function (names, mode, ...args) {
    if (mode === 'readwrite' && Array.from(typeof names === 'string' ? [names] : names).includes('images')) throw new Error('测试：磁盘写入失败');
    return window.originalTransaction.call(this, names, mode, ...args);
  } : window.originalTransaction;
}
export function holdCompletion() {
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) {
    const tx = original.call(this, names, mode, ...args);
    if (mode === 'readwrite' && tx.objectStoreNames.contains('images')) {
      IDBDatabase.prototype.transaction = original;
      tx.addEventListener('complete', event => {
        if (!event.isTrusted) return;
        event.stopImmediatePropagation();
        window.releaseCompletion = () => tx.dispatchEvent(new Event('complete'));
      });
    }
    return tx;
  };
}
export function hangImageDecode() {
  const original = window.createImageBitmap;
  window.createImageBitmap = () => new Promise(resolve => {
    window.finishDecode = () => {
      window.createImageBitmap = original;
      resolve({ width: 1, height: 1, close: () => { window.lateBitmapClosed = true; } });
    };
  });
}
export function loseConfirmation() {
  const nativeFetch = window.fetch;
  window.lostConfirmations = 0;
  window.fetch = async (input, options) => {
    const response = await nativeFetch(input, options);
    if (String(input).endsWith('/api/control/confirm') && window.lostConfirmations++ === 0) { await response.text(); throw new Error('测试：电脑回执响应丢失'); }
    return response;
  };
}
