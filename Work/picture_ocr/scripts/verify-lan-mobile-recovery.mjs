import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/utils/lanUpload.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { synchronizeUpload, queryUploadStatus } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const original = new File(['image'], 'original.png', { type: 'image/png' });
const job = { requestId: 'abcdef1234567890', token: 'test', projectId: 'p1', assetId: 'a', itemId: 'i', original, blob: original, sent: false, recovery: true };
const phases = [], requests = [];
let persisted = false, dropResponse = true;
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  if (options.method === 'POST') { persisted = true; if (dropResponse) { dropResponse = false; throw new Error('connection lost'); } }
  return new Response(JSON.stringify({ state: persisted ? 'saved' : 'not_received', requestId: job.requestId }), { status: persisted ? 201 : 404 });
};
await assert.rejects(synchronizeUpload(job, p => phases.push(p), new AbortController().signal), /connection lost/);
assert.equal(job.original, original);
assert.equal(job.sent, true);
await synchronizeUpload(job, p => phases.push(p), new AbortController().signal);
assert.equal(requests.filter(r => r.options.method === 'POST').length, 1, 'lost response is checked without reposting');
persisted = false;
await synchronizeUpload(job, () => {}, new AbortController().signal);
assert.equal(requests.filter(r => r.options.method === 'POST').length, 2);
for (const request of requests.filter(r => r.options.method === 'POST')) {
  const url = new URL(request.url, 'http://test');
  assert.equal(url.searchParams.get('requestId'), job.requestId);
  assert.equal(url.searchParams.get('projectId'), 'p1');
}
globalThis.fetch = async () => new Response(JSON.stringify({ state: 'failed' }), { status: 503 });
await assert.rejects(synchronizeUpload(job, () => {}, new AbortController().signal), error => error.phase === 'failed');
globalThis.fetch = async () => new Response('{}', { status: 401 });
await assert.rejects(synchronizeUpload(job, () => {}, new AbortController().signal), error => error.phase === 'expired');
const legacy = { ...job, recovery: false, serverRequestId: undefined };
await assert.rejects(synchronizeUpload(legacy, () => {}, new AbortController().signal), /不支持安全重试/);
globalThis.fetch = async (_url, options) => {
  assert.notEqual(options.method, 'POST', '自动恢复核对不得重新上传');
  return new Response(JSON.stringify({ state: 'not_received' }), { status: 404 });
};
await assert.rejects(synchronizeUpload(job, () => {}, new AbortController().signal, 'check'), error => error.phase === 'unconfirmed');
globalThis.fetch = async (_url, options) => {
  assert.notEqual(options.method, 'POST', '保存失败需要人工重试');
  return new Response(JSON.stringify({ state: 'failed' }), { status: 503 });
};
await assert.rejects(synchronizeUpload(job, () => {}, new AbortController().signal, 'check'), error => error.phase === 'failed');
globalThis.fetch = async (_url, options) => {
  assert.notEqual(options.method, 'POST');
  return new Response(JSON.stringify({ state: 'saved' }), { status: 201 });
};
await synchronizeUpload(job, () => {}, new AbortController().signal, 'check');
for (const [state, status] of [['pending', 202], ['saved', 201], ['not_received', 404], ['failed', 503]]) {
  let reads = 0;
  globalThis.fetch = async (url, options) => {
    reads++;
    assert.notEqual(options.method, 'POST');
    assert.equal(new URL(url, 'http://test').searchParams.get('requestId'), job.requestId);
    return new Response(JSON.stringify({ state }), { status });
  };
  assert.equal(await queryUploadStatus(job, new AbortController().signal), state);
  assert.equal(reads, 1, '低频核对只读取一次，不自行循环或重传');
}
console.log('PASS mobile lost response, original retention, stable retry target/id, failure, expired, legacy host and read-only resume');
