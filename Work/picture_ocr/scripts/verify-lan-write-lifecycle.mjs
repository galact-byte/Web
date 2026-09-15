import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export { addImageToProject } from './src/utils/db'; export { hasPendingWrites } from './src/utils/pendingWrites';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const originalTimer = globalThis.setTimeout;
let timeout, tx, aborted = false;
globalThis.setTimeout = (fn, ms, ...args) => ms === 120000 ? (timeout = fn, -1) : originalTimer(fn, ms, ...args);
globalThis.indexedDB = { open() {
  const request = { result: { close() {}, transaction() {
    tx = { objectStore: () => ({ get: () => ({}) }), abort() { aborted = true; } }; return tx;
  } } }; queueMicrotask(() => request.onsuccess()); return request;
} };
try {
  for (const terminal of ['abort', 'complete', 'error']) {
    aborted = false; let settled = false;
    const save = api.addImageToProject('p', 'a', 'i', { id: 'img', data: 'data:image/png;base64,aGVsbG8=', fileName: 'a.png', caption: '', uploadedAt: '' });
    const observed = save.then(() => { settled = true; return 'saved'; }, () => { settled = true; return 'failed'; });
    await new Promise(resolve => originalTimer(resolve, 0));
    assert.equal(api.hasPendingWrites(), true);
    if (terminal === 'error') tx.onerror(); else timeout();
    await new Promise(resolve => originalTimer(resolve, 0));
    assert.equal(settled, false, 'wrapper must wait for the actual transaction terminal event');
    assert.equal(api.hasPendingWrites(), true, 'close guard remains active before real transaction completion');
    if (terminal !== 'error') assert.equal(aborted, true, 'deadline requests abort');
    if (terminal === 'complete') tx.oncomplete(); else tx.onabort();
    assert.equal(await observed, terminal === 'complete' ? 'saved' : 'failed');
    assert.equal(api.hasPendingWrites(), false);
  }
  console.log('PASS transaction timeout/error wait for real complete/abort and preserve pending-write guard');
} finally { globalThis.setTimeout = originalTimer; }
