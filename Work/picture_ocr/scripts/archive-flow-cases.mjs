// 归档/恢复编排用例（由 verify-archive-flow.mjs 在隔离 Chrome/Electron 中执行）。
// 保存目标：Web 实现直接用 OPFS 目录句柄（与 showDirectoryPicker 返回的是同一接口，只是免去用户选目录的弹框）；
// 故障注入用内存目标（mock，仅用于模拟写失败/读回损坏/归档期间并发改动）。桌面 IPC 的真实落盘见 verify-archive-files.cjs。
import JSZip from 'jszip';
import * as db from '../src/utils/db';
import * as fmt from '../src/utils/archiveFormat';
import { archiveProject, archiveProjects, buildArchiveFileName, restoreProject } from '../src/utils/archive';
import { createDirectoryHandleTarget, createDesktopTarget } from '../src/utils/archiveTarget';
import { hasPendingWrites } from '../src/utils/pendingWrites';

const DB_NAME = 'evidence-collector-db';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

/** 内存保存目标：可注入写失败、读回篡改、写入期间回调。 */
function memoryTarget(hooks = {}) {
  const files = new Map();
  return {
    files,
    label: '内存目录',
    sameDriveAsData: null,
    async exists(name) { return files.has(name); },
    async write(name, blob) {
      if (hooks.beforeWrite) await hooks.beforeWrite(name);
      if (hooks.failWrite) throw new Error('模拟磁盘写入失败');
      if (files.has(name)) throw new Error('同名归档文件已存在。');
      files.set(name, new Uint8Array(await blob.arrayBuffer()));
    },
    async read(name) {
      const bytes = files.get(name);
      if (!bytes) throw new Error('文件不存在');
      return new Blob([hooks.corruptRead ? await hooks.corruptRead(bytes) : bytes]);
    },
  };
}

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error && error.stack || error}`, false); }
  };
  const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const rawRead = async (store, key) => {
    const conn = await request(indexedDB.open(DB_NAME));
    try { return await request(conn.transaction(store, 'readonly').objectStore(store).get(key)); } finally { conn.close(); }
  };
  const rawDelete = async (store, key) => {
    const conn = await request(indexedDB.open(DB_NAME));
    const tx = conn.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    conn.close();
  };
  const imageRecords = async (projectId) => {
    const conn = await request(indexedDB.open(DB_NAME));
    try {
      const all = await request(conn.transaction('images', 'readonly').objectStore('images').index('by_project').getAll(projectId));
      return Object.fromEntries(all.map((record) => [record.imageId, record]));
    } finally { conn.close(); }
  };

  await request(indexedDB.deleteDatabase(DB_NAME));
  localStorage.clear();

  const seedSystem = async (name, images = [['img-1', 'a.png', PNG], ['img-2', 'b.jpg', JPG]]) => {
    const [doc] = await db.createProjectGroupWithSystems({ projectCode: 'C1', projectName: '', unitName: '某单位', reportDate: '2026-09-01' }, [name]);
    const asset = doc.assets[0];
    const item = asset.items[0];
    for (const [id, fileName, data] of images) {
      await db.addImageToProject(doc.id, asset.id, item.id, { id, fileName, data, caption: id, uploadedAt: '2026-01-01T00:00:00.000Z' });
    }
    return { id: doc.id, groupId: doc.groupId, assetId: asset.id, itemId: item.id };
  };

  await test('文件名：组显示名回退单位名、非法字符净化、时间戳', async () => {
    const name = buildArchiveFileName({ projectName: '', unitName: '某单位' }, '系统:A/B', new Date(2026, 8, 29, 10, 30));
    check(`文件名格式（${name}）`, name === '归档_某单位_系统_A_B_20260929-1030.zip');
    const noGroup = buildArchiveFileName(null, '', new Date(2026, 0, 2, 3, 4));
    check(`无组/无系统名兜底（${noGroup}）`, noGroup === '归档_未命名项目组_未命名系统_20260102-0304.zip');
  });

  // ---------- Web 目标（OPFS 目录句柄，真实 FileSystemHandle 写入/读回） ----------
  const opfsRoot = await navigator.storage.getDirectory();
  const dir = await opfsRoot.getDirectoryHandle(`archive-${Date.now()}`, { create: true });
  const webTarget = createDirectoryHandleTarget(dir);

  let main;
  let archivedName;
  await test('归档成功：文件落盘、本地字节删除、标记与摘要', async () => {
    main = await seedSystem('系统A');
    const before = await rawRead('projects', main.id);
    const originals = await imageRecords(main.id);
    const outcome = await archiveProject(main.id, webTarget);
    check(`归档返回成功（${outcome.message}）`, outcome.status === 'archived');
    archivedName = outcome.fileName;
    check('文件名带单位名回退', /^归档_某单位_系统A_\d{8}-\d{4}\.zip$/.test(archivedName || ''));
    check('目标目录中存在文件', await webTarget.exists(archivedName));
    check('释放字节 = 原图字节合计', outcome.freedBytes === Object.values(originals).reduce((s, r) => s + r.byteSize, 0) && outcome.freedBytes > 0);
    check('本地图片字节已删除', Object.keys(await imageRecords(main.id)).length === 0);
    const after = await rawRead('projects', main.id);
    check('文档带归档标记', after.archive && after.archive.fileName === archivedName && after.archive.imageCount === 2 && after.archive.locationLabel === webTarget.label);
    check('文档仍保留图片引用', after.assets[0].items[0].images.map((i) => i.id).join() === 'img-1,img-2');
    check('updatedAt 不变', after.updatedAt === before.updatedAt);
    check('摘要带归档标记', (await rawRead('projectSummaries', main.id)).archive?.fingerprint === after.archive.fingerprint);
    const opened = await fmt.openArchive(await (await dir.getFileHandle(archivedName)).getFile());
    check('磁盘文件指纹与标记一致', opened.manifest.fingerprint === after.archive.fingerprint);
    check('归档后无未完成写入', !hasPendingWrites());
    window.__originals = originals;
  });

  await test('已归档系统再次归档被跳过、不生成新文件', async () => {
    const countBefore = await countEntries(dir);
    const outcome = await archiveProject(main.id, webTarget);
    check('状态为 skipped', outcome.status === 'skipped');
    check('未生成新文件', (await countEntries(dir)) === countBefore);
  });

  await test('同名文件自动加序号、不覆盖', async () => {
    const target = memoryTarget();
    const sys = await seedSystem('系统同名');
    const first = buildArchiveFileName({ projectName: '', unitName: '某单位' }, '系统同名', new Date(2026, 8, 29, 10, 30));
    target.files.set(first, new Uint8Array([1]));
    const outcome = await archiveProject(sys.id, target, { now: () => new Date(2026, 8, 29, 10, 30).getTime() });
    check(`序号文件名（${outcome.fileName}）`, outcome.status === 'archived' && outcome.fileName === first.replace(/\.zip$/, '(2).zip'));
    check('原同名文件未被覆盖', target.files.get(first).length === 1);
  });

  await test('恢复：字节逐条相等、标记清除', async () => {
    const file = await (await dir.getFileHandle(archivedName)).getFile();
    await restoreProject(main.id, file);
    const restored = await imageRecords(main.id);
    const originals = window.__originals;
    check('图片数量一致', Object.keys(restored).length === 2);
    check('字节与元数据逐条相等', Object.keys(originals).every((id) => {
      const a = originals[id]; const b = restored[id];
      return b && a.data === b.data && a.mimeType === b.mimeType && a.byteSize === b.byteSize && a.fileName === b.fileName && a.key === b.key;
    }));
    check('文档标记清除', (await rawRead('projects', main.id)).archive == null);
    check('摘要标记清除', (await rawRead('projectSummaries', main.id)).archive == null);
    check('恢复后无未完成写入', !hasPendingWrites());
    const plan = await db.reconcileProjectImages(main.id);
    check('恢复后对账无缺失', plan.missing.length === 0 && !plan.archived);
  });

  await test('恢复拦截：未归档、别的系统、旧归档文件、篡改', async () => {
    const oldFile = await (await dir.getFileHandle(archivedName)).getFile();
    check('未归档系统拒绝恢复', await rejects(restoreProject(main.id, oldFile), /未归档/));
    // 改一张图后重新归档：旧文件指纹与新标记不符。
    const doc = await db.loadProject(main.id);
    await db.removeImageFromProject(main.id, doc.assets[0].id, doc.assets[0].items[0].id, 'img-2');
    const second = await archiveProject(main.id, webTarget);
    check('改动后重新归档成功', second.status === 'archived' && second.fileName !== archivedName);
    check('旧归档文件被拒（指纹不符）', await rejects(restoreProject(main.id, oldFile), /不是该系统当前的归档|不匹配/));
    const other = await seedSystem('系统B');
    const otherOutcome = await archiveProject(other.id, webTarget);
    const otherFile = await (await dir.getFileHandle(otherOutcome.fileName)).getFile();
    check('别的系统的归档文件被拒并说出系统名', await rejects(restoreProject(main.id, otherFile), /系统B/));
    const tampered = await mutateZip(await (await dir.getFileHandle(second.fileName)).getFile(), async (zip) => {
      const m = JSON.parse(await zip.file('archive.json').async('string'));
      const bytes = await zip.file(m.images[0].path).async('uint8array');
      bytes[bytes.length - 1] ^= 0xff;
      zip.file(m.images[0].path, bytes);
    });
    check('篡改图片的文件被拒', await rejects(restoreProject(main.id, tampered), /不一致/));
    check('普通 ZIP 被拒', await rejects(restoreProject(main.id, new Blob(['x'])), /损坏|ZIP/));
    check('被拒后仍为已归档、本地无字节', (await rawRead('projects', main.id)).archive?.fileName === second.fileName && Object.keys(await imageRecords(main.id)).length === 0);
    await restoreProject(main.id, await (await dir.getFileHandle(second.fileName)).getFile());
    check('用正确文件恢复成功', (await rawRead('projects', main.id)).archive == null && Object.keys(await imageRecords(main.id)).length === 1);
  });

  // ---------- 故障注入（内存目标） ----------
  const assertUntouched = async (id, label) => {
    const doc = await rawRead('projects', id);
    check(`${label}：本地未打标记`, doc.archive == null);
    check(`${label}：本地字节仍在`, Object.keys(await imageRecords(id)).length === collectIds(doc).length && collectIds(doc).length > 0);
  };

  await test('写文件失败：本地不动', async () => {
    const sys = await seedSystem('系统写失败');
    const outcome = await archiveProject(sys.id, memoryTarget({ failWrite: true }));
    check(`失败并说明原因（${outcome.message}）`, outcome.status === 'failed' && /写入/.test(outcome.message));
    await assertUntouched(sys.id, '写失败');
  });

  await test('读回内容被改：本地不动、提示文件无效', async () => {
    const sys = await seedSystem('系统读回损坏');
    const target = memoryTarget({ corruptRead: (bytes) => bytes.slice(0, Math.floor(bytes.length / 2)) });
    const outcome = await archiveProject(sys.id, target);
    check(`失败（${outcome.message}）`, outcome.status === 'failed' && outcome.invalidFileLeft === true);
    await assertUntouched(sys.id, '读回损坏');
  });

  await test('本地缺图：拒绝归档、不写文件', async () => {
    const sys = await seedSystem('系统缺图');
    await rawDelete('images', `${sys.id}:img-2`);
    const target = memoryTarget();
    const outcome = await archiveProject(sys.id, target);
    check(`失败并提示缺失张数（${outcome.message}）`, outcome.status === 'failed' && /1 张/.test(outcome.message));
    check('没有写任何文件', target.files.size === 0);
    check('本地未打标记', (await rawRead('projects', sys.id)).archive == null);
  });

  await test('无图片系统：拒绝归档', async () => {
    const sys = await seedSystem('系统空', []);
    const target = memoryTarget();
    const outcome = await archiveProject(sys.id, target);
    check(`失败（${outcome.message}）`, outcome.status === 'failed' && /没有图片/.test(outcome.message) && target.files.size === 0);
  });

  await test('归档期间有新上传：提交取消、本地保留新图', async () => {
    const sys = await seedSystem('系统并发');
    const target = memoryTarget({
      beforeWrite: async () => {
        await db.addImageToProject(sys.id, sys.assetId, sys.itemId, { id: 'img-new', fileName: 'n.png', data: PNG, caption: '', uploadedAt: '2026-02-01T00:00:00.000Z' });
      },
    });
    const outcome = await archiveProject(sys.id, target);
    check(`提交被取消（${outcome.message}）`, outcome.status === 'failed' && /改动/.test(outcome.message));
    check('文件保留且注明有效', target.files.size === 1 && outcome.invalidFileLeft !== true && !!outcome.fileName);
    check('本地三张图都在、未打标记', Object.keys(await imageRecords(sys.id)).length === 3 && (await rawRead('projects', sys.id)).archive == null);
  });

  await test('未整理（内联）系统：先整理再归档', async () => {
    const legacy = db.createProjectDocument();
    legacy.meta = { ...legacy.meta, projectName: '老项目', systemName: '老系统' };
    legacy.assets[0].items[0].images = [{ id: 'old-1', fileName: 'o.png', data: PNG, caption: '', uploadedAt: '2025-01-01T00:00:00.000Z' }];
    await db.saveProject(legacy);
    check('前提：文档内联字节', typeof (await rawRead('projects', legacy.id)).assets[0].items[0].images[0].data === 'string');
    const outcome = await archiveProject(legacy.id, memoryTarget());
    check(`归档成功（${outcome.message}）`, outcome.status === 'archived');
    const after = await rawRead('projects', legacy.id);
    check('文档无内联字节、带标记、images 无记录', after.archive && after.assets[0].items[0].images[0].data === undefined && Object.keys(await imageRecords(legacy.id)).length === 0);
  });

  await test('批量归档：逐个执行、单个失败不影响其它、进度回调', async () => {
    const ok1 = await seedSystem('批量1');
    const bad = await seedSystem('批量缺图');
    await rawDelete('images', `${bad.id}:img-1`);
    const ok2 = await seedSystem('批量2');
    const progress = [];
    const outcomes = await archiveProjects([ok1.id, bad.id, ok2.id], memoryTarget(), (p) => progress.push(`${p.index}/${p.total}`));
    check('三个结果按顺序', outcomes.map((o) => o.status).join() === 'archived,failed,archived');
    check(`进度回调（${progress.join(' ')}）`, progress.join(' ') === '1/3 2/3 3/3');
  });

  await test('桌面目标经 window.evidenceArchive 桥', async () => {
    const calls = [];
    const disk = new Map();
    const bridge = {
      writeFile: async (targetId, name, bytes) => { calls.push(['write', targetId, name, bytes instanceof Uint8Array]); disk.set(name, bytes.slice()); },
      readFile: async (targetId, name) => { calls.push(['read', targetId, name]); return disk.get(name); },
      exists: async (targetId, name) => disk.has(name),
    };
    const target = createDesktopTarget(bridge, { targetId: 't-1', label: 'D:\\归档', drive: 'D:', dataDrive: 'C:', sameDriveAsData: false });
    check('label / sameDriveAsData 透传', target.label === 'D:\\归档' && target.sameDriveAsData === false);
    const sys = await seedSystem('系统桌面');
    const outcome = await archiveProject(sys.id, target);
    check(`经桥归档成功（${outcome.message}）`, outcome.status === 'archived');
    check('写入以 Uint8Array 传给主进程且带 targetId', calls.some((c) => c[0] === 'write' && c[1] === 't-1' && c[3] === true));
    check('从磁盘读回校验', calls.some((c) => c[0] === 'read' && c[2] === outcome.fileName));
  });

  return { results };
}

function collectIds(doc) {
  return doc.assets.flatMap((a) => a.items.flatMap((i) => i.images.map((img) => img.id)));
}

async function rejects(promise, pattern) {
  try { await promise; return false; } catch (error) { return pattern.test(error && error.message); }
}

async function mutateZip(blob, fn) {
  const zip = await JSZip.loadAsync(blob);
  await fn(zip);
  return zip.generateAsync({ type: 'blob' });
}

async function countEntries(dir) {
  let n = 0;
  for await (const _ of dir.keys()) n += 1;
  return n;
}
