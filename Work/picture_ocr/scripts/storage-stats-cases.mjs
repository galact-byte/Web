// 每系统图片占用统计与缓存用例（由 verify-storage-stats.mjs 在隔离 Chrome/Electron 原生 IndexedDB 中执行）。
import * as db from '../src/utils/db';
import { computeStorageStats, readStatsCache } from '../src/utils/storageStats';

const DB_NAME = 'evidence-collector-db';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error && error.stack || error}`, false); }
  };
  const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const withStore = async (store, mode, fn) => {
    const conn = await request(indexedDB.open(DB_NAME));
    const tx = conn.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    conn.close();
    return out;
  };
  const recordsOf = async (projectId) => {
    let req;
    await withStore('images', 'readonly', (s) => { req = s.index('by_project').getAll(projectId); });
    return req.result;
  };

  await request(indexedDB.deleteDatabase(DB_NAME));
  localStorage.clear();

  const seed = async (name, images) => {
    const [doc] = await db.createProjectGroupWithSystems({ projectCode: 'C', projectName: 'P', unitName: 'U', reportDate: '2026-09-01' }, [name]);
    for (const [id, data] of images) {
      await db.addImageToProject(doc.id, doc.assets[0].id, doc.assets[0].items[0].id, { id, fileName: `${id}.png`, data, caption: '', uploadedAt: '2026-01-01T00:00:00.000Z' });
    }
    return doc.id;
  };
  // 新建系统经过一轮整理后才算「已整理」，与真实启动顺序（列表挂载即跑 migrateInlineImages）一致。
  const a = await seed('A', [['a1', PNG], ['a2', JPG]]);
  const b = await seed('B', [['b1', PNG]]);
  await db.migrateInlineImages();
  const summaries = async () => db.listProjects();
  let clock = 1000;
  const now = () => clock;
  const byId = (stats) => Object.fromEntries(stats.map((s) => [s.projectId, s]));

  await test('首次统计与实际 byteSize 合计一致', async () => {
    const stats = byId(await computeStorageStats(await summaries(), { now }));
    const expectA = (await recordsOf(a)).reduce((s, r) => s + r.byteSize, 0);
    check(`A 字节（${stats[a]?.imageBytes} vs ${expectA}）`, stats[a].imageBytes === expectA && stats[a].imageCount === 2 && expectA > 0);
    check('B 一张', stats[b].imageCount === 1);
    check('已整理系统 needsMigration=false', !stats[a].needsMigration && !stats[b].needsMigration);
    check('写入缓存', readStatsCache()[a]?.computedAt === 1000);
  });

  await test('缓存命中与失效', async () => {
    clock = 2000;
    let stats = byId(await computeStorageStats(await summaries(), { now }));
    check('未变化：命中缓存（computedAt 不变）', stats[a].computedAt === 1000 && stats[b].computedAt === 1000);
    // 只改条数、不改 updatedAt（模拟外部删除字节）：count 不一致 → 重算。
    await withStore('images', 'readwrite', (s) => s.delete(`${a}:a2`));
    stats = byId(await computeStorageStats(await summaries(), { now }));
    check('条数变化 → 重算', stats[a].computedAt === 2000 && stats[a].imageCount === 1);
    check('其它系统仍命中', stats[b].computedAt === 1000);
    clock = 3000;
    const summary = (await summaries()).find((s) => s.id === b);
    await withStore('projectSummaries', 'readwrite', (s) => s.put({ ...summary, updatedAt: summary.updatedAt + 1 }));
    stats = byId(await computeStorageStats(await summaries(), { now }));
    check('updatedAt 变化 → 重算', stats[b].computedAt === 3000);
    clock = 4000;
    await db.addImageToProject(a, (await db.loadProject(a)).assets[0].id, (await db.loadProject(a)).assets[0].items[0].id, { id: 'a3', fileName: 'a3.png', data: PNG, caption: '', uploadedAt: '2026-01-01T00:00:00.000Z' });
    stats = byId(await computeStorageStats(await summaries(), { now }));
    check('新增图片 → 重算', stats[a].computedAt === 4000 && stats[a].imageCount === 2);
  });

  await test('写入即为引用形态的系统不等后台整理', async () => {
    const [created] = await db.createProjectGroupWithSystems({ projectCode: 'N', projectName: 'N', unitName: 'U', reportDate: '2026-09-01' }, ['新建']);
    const imported = db.createProjectDocument();
    imported.assets[0].items[0].images = [{ id: 'i1', fileName: 'i.png', data: PNG, caption: '', uploadedAt: '2025-01-01T00:00:00.000Z' }];
    await db.saveProjectWithImages(imported);
    const blank = db.createProjectDocument();
    await db.saveProject(blank);
    const stats = byId(await computeStorageStats(await summaries(), { now }));
    check('新建项目组系统不标待整理', stats[created.id].needsMigration === false);
    check('导入（saveProjectWithImages）后不标待整理、字节计入', stats[imported.id].needsMigration === false && stats[imported.id].imageCount === 1 && stats[imported.id].imageBytes > 0);
    check('无内联图片的 saveProject 不标待整理', stats[blank.id].needsMigration === false);
    for (const id of [created.id, imported.id, blank.id]) await db.deleteProject(id);
  });

  await test('未整理系统标记、已归档系统不读字节', async () => {
    const legacy = db.createProjectDocument();
    legacy.assets[0].items[0].images = [{ id: 'l1', fileName: 'l.png', data: PNG, caption: '', uploadedAt: '2025-01-01T00:00:00.000Z' }];
    await db.saveProject(legacy);
    let stats = byId(await computeStorageStats(await summaries(), { now }));
    check('内联系统标记待整理', stats[legacy.id].needsMigration === true);
    await db.migrateInlineImages();
    stats = byId(await computeStorageStats(await summaries(), { now }));
    check('整理后不再标记、字节计入', stats[legacy.id].needsMigration === false && stats[legacy.id].imageCount === 1 && stats[legacy.id].imageBytes > 0);
    const keys = (await recordsOf(b)).map((r) => r.imageId);
    await db.commitProjectArchive(b, keys, { archivedAt: 1, fileName: 'x.zip', locationLabel: 'D:', imageCount: keys.length, imageBytes: 70, fingerprint: 'e'.repeat(64) });
    stats = byId(await computeStorageStats(await summaries(), { now }));
    check('已归档：archived=true、本地 0 字节、保留归档张数', stats[b].archived === true && stats[b].imageBytes === 0 && stats[b].imageCount === keys.length);
  });

  await test('删除的系统从缓存清除；中断后续跑', async () => {
    await db.deleteProject(a);
    await computeStorageStats(await summaries(), { now });
    check('已删系统不在缓存', !(a in readStatsCache()));
    localStorage.removeItem('evidence-storage-stats-v1');
    clock = 5000;
    const controller = new AbortController();
    const partial = await computeStorageStats(await summaries(), { now, signal: controller.signal, onProgress: () => controller.abort() });
    check('中断后只返回已完成部分', partial.length === 1);
    clock = 6000;
    const all = await computeStorageStats(await summaries(), { now });
    check('续跑：已完成的沿用缓存', all.filter((s) => s.computedAt === 5000).length === 1 && all.length === (await summaries()).length);
  });

  return { results };
}
