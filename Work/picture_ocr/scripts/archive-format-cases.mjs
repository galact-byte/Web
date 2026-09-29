// 归档文件格式用例：打包 ↔ 解析往返、指纹、各类篡改被拒、字节原样重建、可被普通导入识别。
import JSZip from 'jszip';
import * as fmt from '../src/utils/archiveFormat';
import { importDataPackage } from '../src/utils/exportImport';
import * as db from '../src/utils/db';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// 带额外参数的头部，验证原样重建。
const PNG_NAMED = PNG.replace('data:image/png;base64', 'data:image/png;name=b.png;base64');

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error && error.message}`, false); }
  };
  const rejects = async (promise, pattern) => {
    try { await promise; return false; } catch (error) { return error instanceof fmt.ArchiveFormatError && pattern.test(error.message); }
  };
  const makeDoc = () => {
    const doc = db.createProjectDocument();
    doc.meta = { ...doc.meta, projectName: '项目一', systemName: '系统A' };
    const asset = doc.assets[0];
    asset.items[0].images = [
      { id: 'img-1', fileName: 'a.png', data: PNG, caption: '一', uploadedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'img-2', fileName: 'b.png', data: PNG_NAMED, caption: '二', uploadedAt: '2026-01-02T00:00:00.000Z' },
    ];
    return doc;
  };
  const mutate = async (blob, fn) => {
    const zip = await JSZip.loadAsync(blob);
    await fn(zip);
    return zip.generateAsync({ type: 'blob' });
  };

  const doc = makeDoc();
  let built;
  await test('打包', async () => {
    built = await fmt.buildArchive({ doc, group: null, archivedAt: 1790000000000, appVersion: 'test' });
    check('产物为 Blob', built.blob instanceof Blob && built.blob.size > 0);
    check('清单含两张图', built.manifest.images.length === 2);
    check('字节合计正确', built.imageBytes === built.manifest.images.reduce((s, i) => s + i.byteSize, 0));
    check('指纹为 64 位 hex', /^[0-9a-f]{64}$/.test(built.manifest.fingerprint));
    const again = await fmt.buildArchive({ doc, group: null, archivedAt: 1, appVersion: 'x' });
    check('指纹与时间/版本无关、只与内容相关', again.manifest.fingerprint === built.manifest.fingerprint);
    const other = makeDoc();
    other.id = 'another-id';
    check('指纹绑定系统 id', (await fmt.buildArchive({ doc: other, group: null, archivedAt: 1, appVersion: 'x' })).manifest.fingerprint !== built.manifest.fingerprint);
  });

  await test('往返与原样重建', async () => {
    const opened = await fmt.openArchive(built.blob);
    check('打开后 projectId 一致', opened.manifest.projectId === doc.id);
    await fmt.verifyArchiveImages(opened);
    check('逐张校验通过', true);
    const records = await fmt.loadArchiveImages(opened);
    const byId = Object.fromEntries(records.map((r) => [r.imageId, r]));
    check('重建 data URL 与原始完全相同（普通头）', byId['img-1'].data === PNG);
    check('重建 data URL 与原始完全相同（带参数头）', byId['img-2'].data === PNG_NAMED);
    check('记录主键/归属正确', records.every((r) => r.key === `${doc.id}:${r.imageId}` && r.projectId === doc.id));
  });

  await test('篡改与错误文件被拒', async () => {
    check('截断 ZIP 被拒', await rejects(fmt.openArchive(built.blob.slice(0, Math.floor(built.blob.size / 2))), /损坏|ZIP/));
    check('非 ZIP 被拒', await rejects(fmt.openArchive(new Blob(['hello'])), /损坏|ZIP/));
    const plainPackage = await mutate(built.blob, (zip) => zip.remove('archive.json'));
    check('普通数据包（无 archive.json）被拒', await rejects(fmt.openArchive(plainPackage), /archive\.json/));
    const replaced = await mutate(built.blob, async (zip) => {
      const entry = built.manifest.images[0];
      const bytes = await zip.file(entry.path).async('uint8array');
      bytes[bytes.length - 1] ^= 0xff;
      zip.file(entry.path, bytes);
    });
    const openedReplaced = await fmt.openArchive(replaced);
    check('替换一张图：逐张校验被拒', await rejects(fmt.verifyArchiveImages(openedReplaced), /不一致/));
    check('替换一张图：恢复读取被拒', await rejects(fmt.loadArchiveImages(openedReplaced), /不一致/));
    const removed = await mutate(built.blob, (zip) => zip.remove(built.manifest.images[1].path));
    check('删一张图被拒', await rejects(fmt.verifyArchiveImages(await fmt.openArchive(removed)), /缺少图片/));
    const changedId = await mutate(built.blob, async (zip) => {
      const m = JSON.parse(await zip.file('archive.json').async('string'));
      m.projectId = 'someone-else';
      zip.file('archive.json', JSON.stringify(m));
    });
    check('改 projectId 被拒（指纹不符）', await rejects(fmt.openArchive(changedId), /指纹/));
    const droppedEntry = await mutate(built.blob, async (zip) => {
      const m = JSON.parse(await zip.file('archive.json').async('string'));
      m.images = m.images.slice(0, 1);
      m.fingerprint = await fmt.computeArchiveFingerprint(m.projectId, m.images);
      zip.file('archive.json', JSON.stringify(m));
    });
    check('清单少一张且重算指纹：两份清单不一致被拒', await rejects(fmt.openArchive(droppedEntry), /不一致/));
    const badVersion = await mutate(built.blob, async (zip) => {
      const m = JSON.parse(await zip.file('archive.json').async('string'));
      m.version = 99;
      zip.file('archive.json', JSON.stringify(m));
    });
    check('未知版本被拒', await rejects(fmt.openArchive(badVersion), /版本/));
    const missingData = makeDoc();
    missingData.assets[0].items[0].images[1] = { ...missingData.assets[0].items[0].images[1], data: undefined };
    check('本地缺字节时拒绝打包', await rejects(fmt.buildArchive({ doc: missingData, group: null, archivedAt: 1, appVersion: 'x' }), /缺失/));
  });

  await test('可被普通导入识别为新系统', async () => {
    await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('evidence-collector-db'); r.onsuccess = resolve; r.onerror = () => reject(r.error); });
    const file = new File([built.blob], '归档.zip', { type: 'application/zip' });
    // 与 ProjectList 的真实调用一致：导入到一个空白系统（overwrite）。
    const blank = db.createProjectDocument();
    const result = await importDataPackage(file, 'overwrite', blank.assets, blank.categories, blank.meta);
    check(`importDataPackage 成功（${result.message}）`, result.success);
    const imported = result.data;
    const images = imported ? imported.assets.flatMap((a) => a.items.flatMap((i) => i.images)) : [];
    check('导入后图片张数一致', images.length === 2);
  });

  return { results };
}
