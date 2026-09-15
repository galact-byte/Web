import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/utils/asyncDeadline.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { withDeadline, requestJson, abortable } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
await assert.rejects(withDeadline(() => new Promise(() => {}), 20), /超时/);
globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }));
await assert.rejects(requestJson('http://isolated.invalid', {}, 20), /超时/, 'deadline covers JSON body, not just response headers');
const controller = new AbortController();
controller.abort(new Error('cancelled'));
let called = false;
await assert.rejects(withDeadline(() => { called = true; return Promise.resolve(); }, 20, controller.signal), /cancelled/);
assert.equal(called, false);
let finish, cleaned = 0;
const pending = new Promise(resolve => { finish = resolve; });
await assert.rejects(withDeadline(signal => abortable(pending, signal, () => cleaned++), 20), /超时/);
finish({}); await Promise.resolve(); await Promise.resolve();
assert.equal(cleaned, 1, 'late resource is disposed exactly once');
console.log('PASS request headers/body deadlines, ignored cancellation, pre-abort and late resource cleanup');
const nativeNow = Date.now;
const events = new EventTarget();
globalThis.document = events;
let now = nativeNow(); Date.now = () => now;
try {
  const waiting = withDeadline(() => new Promise(() => {}), 10000);
  now += 11000; events.dispatchEvent(new Event('visibilitychange'));
  await assert.rejects(waiting, /超时/, 'foreground resume checks wall-clock deadline without waiting for throttled timer');
} finally { Date.now = nativeNow; delete globalThis.document; }
console.log('PASS background/foreground resume uses actual deadline');
