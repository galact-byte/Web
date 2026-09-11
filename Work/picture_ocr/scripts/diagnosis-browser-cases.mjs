import * as db from '../src/utils/db';
import { buildDiagnosticsReport } from '../src/utils/errorLog';

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error.message}`, false); }
  };
  const request = (r) => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const name = 'evidence-collector-db';
  const stateKey = 'evidence-image-migration-v5';
  const reset = async (version = 5, images = true, index = true) => {
    await request(indexedDB.deleteDatabase(name));
    localStorage.clear();
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = () => {
      for (const store of ['projects', 'projectSummaries', 'projectGroups', 'project']) r.result.createObjectStore(store, { keyPath: 'id' });
      if (images) {
        const s = r.result.createObjectStore('images', { keyPath: 'key' });
        if (index) s.createIndex('by_project', 'projectId');
      }
    };
    (await request(r)).close();
  };
  const seed = async () => {
    const conn = await request(indexedDB.open(name));
    const tx = conn.transaction(['projects', 'images'], 'readwrite');
    for (const id of ['bad', 'good']) tx.objectStore('projects').put({ ...db.createProjectDocument(), id, assets: id === 'bad' ? [] : [{ id: 'a', items: [{ id: 'i', images: [{ id: 'inline', data: 'data:image/png;base64,YQ==', fileName: 'test.png', caption: '', uploadedAt: '' }] }] }] });
    tx.objectStore('images').put({ key: 'bad:img', projectId: 'bad', imageId: 'img', data: 'PRIVATE_BYTES' });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    conn.close();
  };
  await reset();
  await seed();
  await test('关联计数与迁移状态', async () => {
    const rows = await db.getDamagedProjectDiagnostics(['bad', 'none']);
    check('有图计数为 1，无图成功计数为 0', rows[0].images.count === 1 && rows[1].images.count === 0 && rows.every(r => r.images.status === 'ok'));
    check('缺少迁移状态明确 missing', rows[0].migration.status === 'missing');
    localStorage.setItem(stateKey, '{broken');
    check('非法 JSON 明确 invalid', (await db.getDamagedProjectDiagnostics(['bad']))[0].migration.status === 'invalid');
    localStorage.setItem(stateKey, JSON.stringify({ completedIds: [42], damagedIds: [] }));
    check('非法迁移数组明确 invalid', (await db.getDamagedProjectDiagnostics(['bad']))[0].migration.status === 'invalid');
    localStorage.setItem(stateKey, JSON.stringify({ completedIds: ['bad'], damagedIds: ['bad'] }));
    const migration = (await db.getDamagedProjectDiagnostics(['bad']))[0].migration;
    check('保留矛盾状态供诊断', migration.status === 'ok' && migration.completed && migration.damaged);
  });
  await test('单条错误与事务中止继续', async () => {
    const original = IDBIndex.prototype.count;
    for (const mode of ['error', 'abort']) {
      IDBIndex.prototype.count = function(key) {
        const r = original.call(this, key);
        if (key === 'bad') {
          if (mode === 'abort') this.objectStore.transaction.abort();
          else r.addEventListener('success', () => {
            Object.defineProperty(r, 'error', { value: new DOMException('受控读取失败', 'UnknownError') });
            this.objectStore.transaction.dispatchEvent(new Event('error'));
          });
        }
        return r;
      };
      try {
        const rows = await db.getDamagedProjectDiagnostics(['bad', 'none']);
        check(`${mode} 返回未知计数且后续成功`, rows[0].images.status === 'error' && rows[0].images.count === null && rows[1].images.count === 0);
      } finally { IDBIndex.prototype.count = original; }
    }
  });
  await test('超时与迟到连接关闭', async () => {
    const originalOpen = IDBFactory.prototype.open;
    const originalTimer = window.setTimeout;
    const originalClose = IDBDatabase.prototype.close;
    let closed = 0;
    IDBDatabase.prototype.close = function() { closed++; return originalClose.call(this); };
    window.setTimeout = (fn, ms, ...args) => originalTimer(fn, ms === 60000 || ms === 15000 ? 10 : ms, ...args);
    IDBFactory.prototype.open = function(...args) {
      const native = originalOpen.apply(this, args);
      const facade = { result: undefined, error: null };
      native.onsuccess = () => { facade.result = native.result; originalTimer(() => facade.onsuccess?.(), 30); };
      return facade;
    };
    try {
      const rows = await db.getDamagedProjectDiagnostics(['bad']);
      check('打开超时为 error/null', rows[0].images.status === 'error' && rows[0].images.count === null);
      await new Promise(resolve => originalTimer(resolve, 60));
      check('超时后迟到连接关闭', closed === 1);
    } finally {
      IDBFactory.prototype.open = originalOpen;
      IDBDatabase.prototype.close = originalClose;
      window.setTimeout = originalTimer;
    }
    const originalTransaction = IDBDatabase.prototype.transaction;
    let aborted = 0;
    window.setTimeout = (fn, ms, ...args) => originalTimer(fn, ms === 15000 ? 10 : ms, ...args);
    IDBDatabase.prototype.transaction = function() {
      return { objectStore: () => ({ indexNames: { contains: () => true }, index: () => ({ count: () => ({}) }) }), abort: () => { aborted++; } };
    };
    try {
      const row = (await db.getDamagedProjectDiagnostics(['bad']))[0];
      check('事务超时中止且返回未知', row.images.status === 'error' && row.images.count === null && aborted === 1);
    } finally { IDBDatabase.prototype.transaction = originalTransaction; window.setTimeout = originalTimer; }
  });
  await test('迁移状态读取错误', async () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if (key === stateKey) throw new Error('拒绝访问'); return original.call(this, key); };
    try { check('读取状态失败为 error', (await db.getDamagedProjectDiagnostics(['bad']))[0].migration.status === 'error'); }
    finally { Storage.prototype.getItem = original; }
  });
  await test('正常与缺失对账', async () => {
    check('正常记录可对账', (await db.reconcileProjectImages('good')).missing.length === 0);
    let rejected = false;
    try { await db.reconcileProjectImages('none'); } catch { rejected = true; }
    check('不存在不能报一致', rejected);
  });
  // 不改变 keyPath 或存入 null，仅在原生 get 完成时模拟受损返回值。
  const nativeGet = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function(key) {
    const r = nativeGet.call(this, key);
    if (this.name === 'projects' && key === 'bad') r.addEventListener('success', () => Object.defineProperty(r, 'result', { value: null }));
    return r;
  };
  await test('null 与历史完成重检', async () => {
    localStorage.setItem(stateKey, JSON.stringify({ completedIds: ['bad'], damagedIds: [] }));
    await db.ensureSummariesSynced(true);
    const progress = await db.getImageMigrationProgress();
    check('已知异常不计入完成且可从界面重新处理', progress.completed === 0 && progress.pending === 2);
    const report = await db.migrateInlineImages();
    const state = JSON.parse(localStorage.getItem(stateKey));
    check('历史 completed 的已知异常重新检查并失败', report.damagedIds.includes('bad') && !state.completedIds.includes('bad'));
    check('有效记录继续完成并实际搬迁内联图片', state.completedIds.includes('good') && report.migrated === 1);
    let rejected = false;
    try { await db.reconcileProjectImages('bad'); } catch { rejected = true; }
    check('null 对账必须失败', rejected);
    const second = await db.migrateInlineImages(true);
    check('强制重试仍报告 null，完成列表不污染', second.damagedIds.includes('bad') && !JSON.parse(localStorage.getItem(stateKey)).completedIds.includes('bad'));
  });
  await test('诊断全链只读且无字节', async () => {
    const originals = [];
    let writes = 0;
    let bytesReads = 0;
    for (const method of ['put', 'add', 'delete', 'clear', 'get', 'getAll', 'openCursor']) {
      const original = IDBObjectStore.prototype[method];
      originals.push(() => { IDBObjectStore.prototype[method] = original; });
      IDBObjectStore.prototype[method] = function(...args) {
        if (['put', 'add', 'delete', 'clear'].includes(method)) writes++;
        if (this.name === 'images' && ['get', 'getAll', 'openCursor'].includes(method)) bytesReads++;
        return original.apply(this, args);
      };
    }
    try {
      const report = await buildDiagnosticsReport();
      check('完整自检报告与异常详情未投影丢失', report.repair === db.getLastSummaryRepairReport() && report.repair.damagedRecords[0].valueType === 'null');
      check('诊断带异常关联元数据', report.damagedProjects?.[0]?.images.count === 1);
      check('诊断零写入且不读图片字节', writes === 0 && bytesReads === 0 && !JSON.stringify(report).includes('PRIVATE_BYTES'));
    } finally { originals.reverse().forEach(restore => restore()); }
  });
  IDBObjectStore.prototype.get = nativeGet;
  await test('缺失迁移不等同 null', async () => {
    check('原生不存在记录无需搬迁', await db.ensureProjectImagesMigrated('none') === false);
  });
  await test('非法文档无写入与图片保留', async () => {
    for (const value of [42, [], {}, { assets: [null] }]) {
      IDBObjectStore.prototype.get = function(key) {
        const r = nativeGet.call(this, key);
        if (this.name === 'projects' && key === 'bad') r.addEventListener('success', () => Object.defineProperty(r, 'result', { value }));
        return r;
      };
      const report = await db.migrateInlineImages(true);
      check(`非法文档 ${JSON.stringify(value)} 拒绝迁移`, report.damagedIds.includes('bad'));
    }
    IDBObjectStore.prototype.get = nativeGet;
    const conn = await request(indexedDB.open(name));
    const tx = conn.transaction(['projects', 'images'], 'readonly');
    const doc = tx.objectStore('projects').get('bad');
    const img = tx.objectStore('images').get('bad:img');
    await new Promise(resolve => { tx.oncomplete = resolve; });
    check('失败后主文档和图片仍保持原样', doc.result.id === 'bad' && img.result.data === 'PRIVATE_BYTES');
    conn.close();
  });
  await test('缺 store 与缺索引不升级', async () => {
    await reset(4, false);
    const row = (await db.getDamagedProjectDiagnostics(['bad']))[0];
    check('无 images store 为 unsupported/null', row.images.status === 'unsupported' && row.images.count === null);
    check('诊断未升级旧库', (await indexedDB.databases()).find(d => d.name === name).version === 4);
    await reset(5, true, false);
    check('无索引为 unsupported', (await db.getDamagedProjectDiagnostics(['bad']))[0].images.status === 'unsupported');
  });
  await test('不存在数据库不建库', async () => {
    await request(indexedDB.deleteDatabase(name));
    const row = (await db.getDamagedProjectDiagnostics(['bad']))[0];
    check('无数据库明确 missing/null', row.images.status === 'missing' && row.images.count === null);
    await buildDiagnosticsReport();
    check('完整诊断未创建数据库', !(await indexedDB.databases()).some(d => d.name === name));
  });
  return { platform: window.evidenceData ? 'desktop' : 'web', results };
}
