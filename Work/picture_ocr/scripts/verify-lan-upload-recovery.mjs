import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { startWeb, snapshot, image } from './lan-test-helpers.mjs';
const { createLanCollectorServer } = createRequire(import.meta.url)('../electron/lanServer.cjs');
const web = await startWeb();
let desktop;
try {
  for (const kind of ['web', 'desktop']) {
    let base, token, pending = [], saves = 0, firstOutcome;
    const confirm = async (success = true) => {
      if (kind === 'web') {
        const upload = (await web.control('pending')).data.upload;
        assert.ok(upload);
        const outcome = { requestId: upload.requestId, sessionId: upload.sessionId, attempt: upload.attempt, success };
        firstOutcome ??= outcome;
        assert.equal((await web.control('confirm', outcome)).status, 200);
        assert.equal((await web.control('confirm', outcome)).status, 200, 'confirmation response can be lost and safely retried');
      } else { const save = pending.shift(); assert.ok(save); success ? save.resolve() : save.reject(new Error('injected storage failure')); }
      await delay(50);
    };
    if (kind === 'web') {
      const started = await web.control('start', { snapshot, selectedAddress: '127.0.0.2' });
      assert.equal(started.status, 200, JSON.stringify(started));
      base = `http://127.0.0.2:${web.port}`; token = started.data.url.split('/').at(-1);
    } else {
      desktop = await createLanCollectorServer({ staticDir: `${web.root}/dist`, snapshot, onImage: (upload) => { saves++; return new Promise((resolve, reject) => pending.push({ upload, resolve, reject })); } });
      base = `http://127.0.0.1:${desktop.port}`; token = desktop.token;
    }
    const api = async (route, options) => {
      const response = await fetch(`${base}/api/${route}${route.includes('?') ? '&' : '?'}token=${token}`, { ...options, signal: AbortSignal.timeout(2000) });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await api('session')).data.uploadRecovery, 1, `${kind} advertises recovery capability`);
    const id = 'fixed-request-1234567890';
    const upload = (bytes = image, retry = false) => api(`upload?projectId=test-project&assetId=asset&itemId=item&requestId=${id}${retry ? '&retry=1' : ''}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: bytes });
    assert.equal((await api(`upload-status?requestId=${id}`)).data.state, 'not_received');
    assert.equal((await upload()).status, 202);
    assert.equal((await upload()).status, 202, 'lost acceptance response retry returns same request');
    assert.equal((await upload(Buffer.concat([image, Buffer.from('different')]))).status, 409);
    await confirm(false);
    assert.equal((await api(`upload-status?requestId=${id}`)).data.state, 'failed');
    assert.equal((await upload()).data.state, 'failed', 'failure is not automatically replayed');
    assert.equal((await upload(image, true)).status, 202);
    await confirm(true);
    assert.equal((await api(`upload-status?requestId=${id}`)).status, 201);
    assert.equal((await upload()).status, 201, 'lost saved response never causes another save');
    if (kind === 'desktop') assert.equal(saves, 2, 'one attempt and one explicit retry only');
    else assert.equal((await web.control('pending')).data.upload, null);
    if (kind === 'web') assert.equal((await web.control('confirm', firstOutcome)).status, 409, 'late old-attempt failure cannot replace later success');
    const post = (requestId, projectId = 'test-project') => api(`upload?projectId=${projectId}&assetId=asset&itemId=item&requestId=${requestId}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: image });
    assert.equal((await post('bad')).status, 400);
    const secondTarget = { ...snapshot, systems: [...snapshot.systems, { ...snapshot.systems[0], projectId: 'other-project' }] };
    if (kind === 'web') await web.control('update', { snapshot: secondTarget }); else desktop.updateSnapshot(secondTarget);
    assert.equal((await post(id, 'other-project')).status, 409, 'same identity cannot change allowed target');
    for (let index = 0; index < 8; index++) assert.equal((await post(`queued-request-${index}-123456`)).status, 202);
    assert.equal((await post('queue-overflow-123456')).status, 429, 'unconfirmed save queue is bounded');
    assert.equal((await post('queued-request-0-123456')).status, 202, 'duplicate remains queryable at capacity');
    await confirm();
    assert.equal((await post('queue-overflow-123456')).status, 202, 'save completion releases capacity');
    for (let index = 0; index < 8; index++) await confirm();
    if (kind === 'web') {
      await web.control('stop', {});
      base = web.base;
      assert.equal((await api(`upload-status?requestId=${id}`)).status, 401);
      await web.control('start', { snapshot, selectedAddress: '127.0.0.2' });
      assert.equal((await web.control('confirm', firstOutcome)).status, 409, 'old session confirmation cannot affect new session');
    }
    assert.ok(!web.output().includes(token) && !web.output().includes(image.toString('base64')), 'logs exclude token and bytes');
    console.log(`PASS ${kind}: stable identity, content/target conflict, explicit retry, duplicate/lost/late confirmations, bounded queue`);
  }
} finally { await desktop?.close(); await web.stop(); }
