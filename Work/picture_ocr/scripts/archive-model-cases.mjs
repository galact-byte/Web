// 归档标记与库内归档/恢复事务的原生 IndexedDB 用例（由 verify-archive-model.mjs 在隔离 Chrome/Electron 中执行）。
import * as db from '../src/utils/db';
import { hasPendingWrites } from '../src/utils/pendingWrites';

const DB_NAME = 'evidence-collector-db';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error && error.message}`, false); }
  };
  const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const rawRead = async (store, key) => {
    const conn = await request(indexedDB.open(DB_NAME));
    try { return await request(conn.transaction(store, 'readonly').objectStore(store).get(key)); } finally { conn.close(); }
  };
  const rawPut = async (store, value) => {
    const conn = await request(indexedDB.open(DB_NAME));
    const tx = conn.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    conn.close();
  };
  const rawDelete = async (store, key) => {
    const conn = await request(indexedDB.open(DB_NAME));
    const tx = conn.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    conn.close();
  };
  const imageKeys = async (projectId) => {
    const conn = await request(indexedDB.open(DB_NAME));
    try { return (await request(conn.transaction('images', 'readonly').objectStore('images').index('by_project').getAllKeys(projectId))).map(String).sort(); } finally { conn.close(); }
  };
  const info = (overrides = {}) => ({
    archivedAt: 1790000000000, fileName: '归档_测试.zip', locationLabel: 'D:\\归档', imageCount: 2, imageBytes: 120, fingerprint: 'f'.repeat(64), ...overrides,
  });

  await request(indexedDB.deleteDatabase(DB_NAME));
  localStorage.clear();

  // 建一个带两张图的已迁移系统。
  const seedSystem = async (name = '系统A') => {
    const [doc] = await db.createProjectGroupWithSystems({ projectCode: 'C1', projectName: '项目一', unitName: '单位', reportDate: '2026-09-01' }, [name]);
    const asset = doc.assets[0];
    const item = asset.items[0];
    await db.addImageToProject(doc.id, asset.id, item.id, { id: 'img-1', fileName: 'a.png', data: PNG, caption: '一', uploadedAt: '2026-01-01T00:00:00.000Z' });
    await db.addImageToProject(doc.id, asset.id, item.id, { id: 'img-2', fileName: 'b.jpg', data: JPG, caption: '二', uploadedAt: '2026-01-02T00:00:00.000Z' });
    return { doc: await db.loadProject(doc.id), assetId: asset.id, itemId: item.id };
  };

  await test('normalize 透传与非法值归一', async () => {
    const base = db.createProjectDocument();
    const kept = db.normalizeProjectDocument({ ...base, archive: info() });
    check('normalizeProjectDocument 保留合法 archive', kept.archive && kept.archive.fingerprint === 'f'.repeat(64) && kept.archive.imageCount === 2);
    for (const bad of [{ archivedAt: 'x' }, { fingerprint: '' }, { imageCount: -1 }, 'yes', 42]) {
      const value = typeof bad === 'object' ? info(bad) : bad;
      check(`非法 archive ${JSON.stringify(bad)} 归一为 null`, db.normalizeProjectDocument({ ...base, archive: value }).archive === null);
    }
    check('缺省 archive 为 null', db.normalizeProjectDocument(base).archive === null);
  });

  let fixture;
  await test('各写路径后标记仍在', async () => {
    fixture = await seedSystem();
    const { doc } = fixture;
    // 直接给文档与摘要打标记（模拟归档后状态，不删字节，只测透传）。
    await db.saveProject({ ...doc, archive: info() });
    check('saveProject 后文档带标记', (await rawRead('projects', doc.id)).archive?.fileName === '归档_测试.zip');
    check('saveProject 后摘要带标记', (await rawRead('projectSummaries', doc.id)).archive?.fileName === '归档_测试.zip');
    const listed = (await db.listProjects()).find((s) => s.id === doc.id);
    check('listProjects 摘要带标记', listed?.archive?.fingerprint === 'f'.repeat(64));
    const group = await db.loadProjectGroup(doc.groupId);
    await db.updateProjectGroupAndSystems({ ...group, projectName: '项目一改名' });
    const afterGroup = await rawRead('projects', doc.id);
    check('updateProjectGroupAndSystems 后文档仍带标记', afterGroup.archive?.fileName === '归档_测试.zip' && afterGroup.meta.projectName === '项目一改名');
    check('updateProjectGroupAndSystems 后摘要仍带标记', (await rawRead('projectSummaries', doc.id)).archive?.fileName === '归档_测试.zip');
    await db.saveProjectWithImages({ ...(await db.loadProject(doc.id)) });
    check('saveProjectWithImages 后仍带标记', (await rawRead('projects', doc.id)).archive?.fileName === '归档_测试.zip');
    await rawDelete('projectSummaries', doc.id);
    await db.ensureSummariesSynced(true);
    check('摘要补建后带标记', (await rawRead('projectSummaries', doc.id)).archive?.fileName === '归档_测试.zip');
    const groups = await db.listProjectGroups();
    const sys = groups.flatMap((g) => g.systems).find((s) => s.id === doc.id);
    check('listProjectGroups 系统摘要带标记', sys?.archive?.fileName === '归档_测试.zip');
  });

  await test('已归档系统库内拒绝增删图片', async () => {
    const { doc, assetId, itemId } = fixture;
    let addError = null;
    try { await db.addImageToProject(doc.id, assetId, itemId, { id: 'img-3', fileName: 'c.png', data: PNG, caption: '', uploadedAt: '' }); } catch (e) { addError = e; }
    check('addImageToProject 被拒且提示已归档', addError && /已归档/.test(addError.message));
    check('被拒后未写入字节', !(await imageKeys(doc.id)).includes(`${doc.id}:img-3`));
    let removeError = null;
    try { await db.removeImageFromProject(doc.id, assetId, itemId, 'img-1'); } catch (e) { removeError = e; }
    check('removeImageFromProject 被拒且提示已归档', removeError && /已归档/.test(removeError.message));
    check('被拒后字节仍在', (await imageKeys(doc.id)).includes(`${doc.id}:img-1`));
    check('拒绝后无未完成写入', !hasPendingWrites());

    // 整份文档写入：工作台/手机采集页可经 URL 直接打开已归档系统，它们构造的文档不带 archive 字段，
    // 一次自动保存就会把标记写成 null——本地已无字节、又不显示已归档。库内必须拒绝。
    const archivedDoc = await db.loadProject(doc.id);
    const { archive: _dropped, ...withoutMarker } = archivedDoc;
    const saveError = await db.saveProject({ ...withoutMarker, meta: { ...archivedDoc.meta, systemName: '被改' }, updatedAt: Date.now() }).then(() => null, (e) => e);
    check('不带标记的 saveProject 被拒且提示已归档', saveError && /已归档/.test(saveError.message));
    const nullError = await db.saveProject({ ...archivedDoc, archive: null }).then(() => null, (e) => e);
    check('标记置 null 的 saveProject 被拒', nullError && /已归档/.test(nullError.message));
    const otherError = await db.saveProject({ ...archivedDoc, archive: info({ fingerprint: 'a'.repeat(64) }) }).then(() => null, (e) => e);
    check('换成别的标记的 saveProject 被拒', otherError && /已归档/.test(otherError.message));
    const afterReject = await rawRead('projects', doc.id);
    check('被拒后文档与摘要标记、名称不变', afterReject.archive?.fingerprint === 'f'.repeat(64) && afterReject.meta.systemName !== '被改' && (await rawRead('projectSummaries', doc.id)).archive?.fingerprint === 'f'.repeat(64));
    await db.saveProject({ ...archivedDoc, meta: { ...archivedDoc.meta, systemName: '改名保留标记' } });
    check('带同一标记改名称允许', (await rawRead('projects', doc.id)).meta.systemName === '改名保留标记' && (await rawRead('projects', doc.id)).archive?.fingerprint === 'f'.repeat(64));
    const withBytes = structuredClone(archivedDoc);
    withBytes.assets[0].items[0].images.push({ id: 'img-9', fileName: 'z.png', data: PNG, caption: '', uploadedAt: '' });
    const bytesError = await db.saveProjectWithImages(withBytes).then(() => null, (e) => e);
    check('saveProjectWithImages 向已归档系统写字节被拒', bytesError && /已归档/.test(bytesError.message));
    check('被拒后未写入字节', !(await imageKeys(doc.id)).includes(`${doc.id}:img-9`));
    const { archive: _d2, ...importLike } = withBytes;
    const importError = await db.saveProjectWithImages(importLike).then(() => null, (e) => e);
    check('不带标记的 saveProjectWithImages 被拒', importError && /已归档/.test(importError.message));
    check('整份写入被拒后无未完成写入', !hasPendingWrites());
    // 撤销标记，恢复为普通系统供后续用例。
    await rawPut('projects', { ...(await rawRead('projects', doc.id)), archive: null });
    await rawPut('projectSummaries', { ...(await rawRead('projectSummaries', doc.id)), archive: null });
  });

  await test('commitProjectArchive', async () => {
    const { doc } = fixture;
    const before = await rawRead('projects', doc.id);
    // 引用集合不符：少报一张 → 拒绝，数据不变。
    let mismatch = null;
    try { await db.commitProjectArchive(doc.id, ['img-1'], info()); } catch (e) { mismatch = e; }
    check('期望图片集合不符时拒绝', mismatch && /改动/.test(mismatch.message));
    check('拒绝后字节不变', (await imageKeys(doc.id)).length === 2);
    check('拒绝后文档无标记', !(await rawRead('projects', doc.id)).archive);
    // 字节集合不符：多一条孤立字节 → 拒绝。
    await rawPut('images', { key: `${doc.id}:ghost`, projectId: doc.id, imageId: 'ghost', data: PNG, fileName: 'g.png', mimeType: 'image/png', byteSize: 1, createdAt: '' });
    let ghost = null;
    try { await db.commitProjectArchive(doc.id, ['img-1', 'img-2'], info()); } catch (e) { ghost = e; }
    check('本地字节与引用不一致时拒绝', ghost && /改动/.test(ghost.message));
    await rawDelete('images', `${doc.id}:ghost`);
    // 正常提交。
    await db.commitProjectArchive(doc.id, ['img-2', 'img-1'], info());
    const after = await rawRead('projects', doc.id);
    check('提交后字节全部删除', (await imageKeys(doc.id)).length === 0);
    check('提交后文档带标记', after.archive?.fingerprint === 'f'.repeat(64));
    check('提交后摘要带标记', (await rawRead('projectSummaries', doc.id)).archive?.fingerprint === 'f'.repeat(64));
    check('提交后 updatedAt 不变', after.updatedAt === before.updatedAt);
    const refs = after.assets.flatMap((a) => a.items.flatMap((i) => i.images));
    check('提交后图片引用与说明保留', refs.length === 2 && refs.every((r) => r.data === undefined) && refs.some((r) => r.caption === '一'));
    let again = null;
    try { await db.commitProjectArchive(doc.id, ['img-1', 'img-2'], info()); } catch (e) { again = e; }
    check('重复归档被拒', again && /已归档/.test(again.message));
    const plan = await db.reconcileProjectImages(doc.id);
    check('自检对已归档系统不报缺失', plan.missing.length === 0 && plan.archived === true);
  });

  await test('restoreProjectArchive', async () => {
    const { doc } = fixture;
    const records = [
      { key: `${doc.id}:img-1`, projectId: doc.id, imageId: 'img-1', data: PNG, fileName: 'a.png', mimeType: 'image/png', byteSize: 70, createdAt: '2026-01-01T00:00:00.000Z' },
      { key: `${doc.id}:img-2`, projectId: doc.id, imageId: 'img-2', data: JPG, fileName: 'b.jpg', mimeType: 'image/jpeg', byteSize: 120, createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    let wrongFp = null;
    try { await db.restoreProjectArchive(doc.id, '0'.repeat(64), records); } catch (e) { wrongFp = e; }
    check('指纹不符时拒绝', wrongFp && /不匹配/.test(wrongFp.message));
    let partial = null;
    try { await db.restoreProjectArchive(doc.id, 'f'.repeat(64), records.slice(0, 1)); } catch (e) { partial = e; }
    check('图片集合不全时拒绝', partial && /不一致/.test(partial.message));
    check('拒绝后仍为已归档且无字节', (await rawRead('projects', doc.id)).archive && (await imageKeys(doc.id)).length === 0);
    // 模拟写入失败：第二条 put 抛错 → 整体回滚。
    const originalPut = IDBObjectStore.prototype.put;
    let calls = 0;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'images' && ++calls === 2) throw new DOMException('受控写入失败', 'QuotaExceededError');
      return originalPut.call(this, value, key);
    };
    let quota = null;
    try { await db.restoreProjectArchive(doc.id, 'f'.repeat(64), records); } catch (e) { quota = e; } finally { IDBObjectStore.prototype.put = originalPut; }
    check('写入失败时报错', !!quota);
    check('写入失败整体回滚', (await imageKeys(doc.id)).length === 0 && (await rawRead('projects', doc.id)).archive);
    await db.restoreProjectArchive(doc.id, 'f'.repeat(64), records);
    check('恢复后字节逐条相等', (await rawRead('images', `${doc.id}:img-1`)).data === PNG && (await rawRead('images', `${doc.id}:img-2`)).data === JPG);
    check('恢复后文档与摘要去掉标记', !(await rawRead('projects', doc.id)).archive && !(await rawRead('projectSummaries', doc.id)).archive);
    check('恢复后 reconcile 一致', (await db.reconcileProjectImages(doc.id)).missing.length === 0);
    check('恢复后无未完成写入', !hasPendingWrites());
    let notArchived = null;
    try { await db.restoreProjectArchive(doc.id, 'f'.repeat(64), records); } catch (e) { notArchived = e; }
    check('未归档系统不能恢复', notArchived && /未归档/.test(notArchived.message));
  });

  return { results };
}
