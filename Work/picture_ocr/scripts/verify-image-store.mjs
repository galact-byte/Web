// 校验「图片字节拆分独立 images store」链路：
// 1) 纯逻辑 src/utils/imageStore.ts（key 构造、内联图收集、剥离、对账差集、迁移选目标）用真实调用测试；
// 2) db.ts 契约：DB_VERSION=5、升级只建表不遍历、写/读/删入口、删除清理、迁移「先写→读回校验→再剥离」同事务。
// 读源码做断言前先归一化 CRLF（Windows 工作区源码为 CRLF）。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

const checks = [];
const check = (name, ok) => checks.push([name, !!ok]);

const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const JPG_DATA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==';

// ---------- 1) 纯逻辑真实调用 ----------
const outDir = mkdtempSync(path.join(tmpdir(), 'image-store-'));
try {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/typescript/bin/tsc'),
      'src/utils/imageStore.ts',
      '--outDir', outDir,
      '--module', 'esnext',
      '--target', 'es2020',
      '--strict',
      '--skipLibCheck',
      '--typeRoots', './no-such-types',
    ],
    { cwd: root, stdio: 'pipe' }
  );
  const mod = await import(pathToFileURL(path.join(outDir, 'imageStore.js')).href);
  const {
    IMAGES_STORE_NAME,
    IMAGES_PROJECT_INDEX,
    imageRecordKey,
    buildStoredImage,
    collectInlineImages,
    collectImageRefs,
    stripInlineImageData,
    planImageReconcile,
    planMigrationTargets,
    estimateBase64Bytes,
  } = mod;

  check('images store 名称为 images', IMAGES_STORE_NAME === 'images');
  check('按项目索引名为 by_project', IMAGES_PROJECT_INDEX === 'by_project');
  check('主键为 `${projectId}:${imageId}`', imageRecordKey('p1', 'img-9') === 'p1:img-9');

  const inlineImage = { id: 'img-1', fileName: 'a.png', data: PNG_DATA, caption: '', uploadedAt: '2026-09-09T00:00:00.000Z' };
  const record = buildStoredImage('p1', inlineImage);
  check('buildStoredImage 生成记录 key 与主键一致', record && record.key === 'p1:img-1');
  check('buildStoredImage 保留 projectId/imageId', record && record.projectId === 'p1' && record.imageId === 'img-1');
  check('buildStoredImage 解析 mimeType', record && record.mimeType === 'image/png');
  check('buildStoredImage 记录字节数', record && record.byteSize > 0);
  check('buildStoredImage 保留原始 data', record && record.data === PNG_DATA);
  check('buildStoredImage 对无 data 的引用返回 null', buildStoredImage('p1', { id: 'img-2', fileName: 'b.png', caption: '', uploadedAt: '' }) === null);

  const doc = {
    id: 'p1',
    assets: [
      {
        id: 'a1',
        items: [
          { id: 'i1', images: [inlineImage, { id: 'img-ref', fileName: 'c.png', caption: 'x', uploadedAt: 'T' }] },
          { id: 'i2', images: [{ id: 'img-3', fileName: 'd.jpg', data: JPG_DATA, caption: '', uploadedAt: '' }] },
        ],
      },
    ],
  };

  const inline = collectInlineImages(doc);
  check('collectInlineImages 跨检查项收集内联图', inline.length === 2);
  check('collectInlineImages 忽略已是引用的图', inline.every((entry) => entry.image.id !== 'img-ref'));
  check('collectInlineImages 带出 assetId/itemId', inline[0].assetId === 'a1' && inline[0].itemId === 'i1');

  check('collectImageRefs 返回全部图片 id（含引用形态）', collectImageRefs(doc).sort().join(',') === 'img-1,img-3,img-ref');

  const stripped = stripInlineImageData(doc, new Set(['img-1']));
  const strippedImg = stripped.assets[0].items[0].images[0];
  check('stripInlineImageData 去掉已迁移图片的 data', strippedImg.data === undefined);
  check('stripInlineImageData 保留元数据', strippedImg.id === 'img-1' && strippedImg.fileName === 'a.png' && strippedImg.uploadedAt === inlineImage.uploadedAt);
  check('stripInlineImageData 不动未迁移的图', stripped.assets[0].items[1].images[0].data === JPG_DATA);
  check('stripInlineImageData 不改动原文档（纯函数）', doc.assets[0].items[0].images[0].data === PNG_DATA);

  const reconcile = planImageReconcile('p1', ['img-1', 'img-3', 'img-ref'], ['p1:img-1', 'p1:img-9']);
  check('planImageReconcile 报出文档引用但字节缺失的图', reconcile.missing.sort().join(',') === 'img-3,img-ref');
  check('planImageReconcile 报出无人引用的孤儿字节', reconcile.orphans.join(',') === 'img-9');
  const clean = planImageReconcile('p1', ['img-1'], ['p1:img-1']);
  check('planImageReconcile 完全匹配时无差异', clean.missing.length === 0 && clean.orphans.length === 0);

  const targets = planMigrationTargets(['p1', 'p2', 'p3', 'p4'], { completedIds: ['p1'], damagedIds: ['p2'] });
  check('planMigrationTargets 跳过已完成项目', !targets.includes('p1'));
  check('planMigrationTargets 跳过已知损坏项目', !targets.includes('p2'));
  check('planMigrationTargets 返回剩余待迁移项目', targets.join(',') === 'p3,p4');

  // 'iVBORw0KGgoAAAANSUhEUg==' 共 24 个 base64 字符（含 2 个填充），对应 16 字节。
  check('estimateBase64Bytes 按 base64 规则精确换算', estimateBase64Bytes(PNG_DATA) === 16);
  check('estimateBase64Bytes 空值为 0', estimateBase64Bytes('') === 0);
  check('estimateBase64Bytes 兼容无头的纯 base64', estimateBase64Bytes('iVBORw0KGgoAAAANSUhEUg==') === 16);
} catch (error) {
  check(`imageStore.ts 纯逻辑可编译并通过真实调用（${error.message.split('\n')[0]}）`, false);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

// ---------- 2) db.ts 契约 ----------
const db = read('src/utils/db.ts');

check('DB_VERSION 升到 5', /const DB_VERSION = 5;/.test(db));
check('db.ts 复用 imageStore 的常量与纯逻辑', /from '\.\/imageStore'/.test(db));

const upgradeStart = db.indexOf('request.onupgradeneeded');
const upgradeEnd = db.indexOf('\n    };', upgradeStart);
const upgradeBlock = upgradeStart >= 0 && upgradeEnd > upgradeStart ? db.slice(upgradeStart, upgradeEnd) : '';
check('升级回调里创建 images store', /createObjectStore\(IMAGES_STORE_NAME/.test(upgradeBlock));
check('升级回调里建 by_project 索引', /createIndex\(IMAGES_PROJECT_INDEX, 'projectId'/.test(upgradeBlock));
check('升级回调绝不遍历数据（无 openCursor/getAll）', upgradeBlock.length > 0 && !/openCursor|getAll/.test(upgradeBlock));

check('导出写入入口 addImageToProject', /export async function addImageToProject/.test(db));
const addBlock = db.slice(db.indexOf('export async function addImageToProject'), db.indexOf('export async function addImageToProject') + 2600);
const addTxMatch = /db\.transaction\(\[([^\]]*)\], 'readwrite'\)/.exec(addBlock);
const addTxStores = addTxMatch ? addTxMatch[1] : '';
check(
  'addImageToProject 同事务覆盖 images/projects/summaries',
  ['IMAGES_STORE_NAME', 'PROJECTS_STORE_NAME', 'PROJECT_SUMMARIES_STORE_NAME'].every((name) => addTxStores.includes(name))
);
check('addImageToProject 从库里读改写文档（不接受调用方整份快照）', /projectsStore\.get\(projectId\)/.test(addBlock));

check('导出删除入口 removeImageFromProject', /export async function removeImageFromProject/.test(db));
check('导出读取入口 resolveImageData', /export async function resolveImageData/.test(db));
const resolveBlock = db.slice(db.indexOf('export async function resolveImageData'), db.indexOf('export async function resolveImageData') + 900);
check('resolveImageData 优先使用内联 data（兼容未迁移形态）', /image\.data/.test(resolveBlock));
check('导出批量读取 resolveImagesForProject', /export async function resolveImagesForProject/.test(db));
check('批量读取走 by_project 索引', /index\(IMAGES_PROJECT_INDEX\)/.test(db));

const delProject = db.slice(db.indexOf('export async function deleteProject('), db.indexOf('export async function deleteProjectGroup('));
check('deleteProject 事务包含 images store', /IMAGES_STORE_NAME/.test(delProject));
const delGroup = db.slice(db.indexOf('export async function deleteProjectGroup('), db.indexOf('export async function deleteProjectGroup(') + 2200);
check('deleteProjectGroup 一并清理 images', /IMAGES_STORE_NAME/.test(delGroup));

check('导出迁移入口 migrateInlineImages', /export async function migrateInlineImages/.test(db));
const migrateStart = db.indexOf('async function migrateProjectImages');
const migrateBlock = migrateStart >= 0 ? db.slice(migrateStart, migrateStart + 3000) : '';
check('迁移按单个项目开事务（不做全库大事务）', /async function migrateProjectImages\(/.test(db) && /db\.transaction\(\[/.test(migrateBlock));
check('迁移写入后在同事务读回校验', /读回校验|verifyRequest|readBack/.test(migrateBlock));
check('迁移校验通过后才剥离内联 data', /stripInlineImageData/.test(migrateBlock));
check('单个项目迁移失败记入 damagedIds 且不中断整体', /damagedIds/.test(db) && /catch/.test(db.slice(db.indexOf('export async function migrateInlineImages'), db.indexOf('export async function migrateInlineImages') + 2200)));
check('迁移进度可持久化以便续跑', /migration|MIGRATION/i.test(db));

check('存储诊断包含 images 条数', /images: /.test(db) && /countInto\(IMAGES_STORE_NAME/.test(db));

// ---------- 第 3 段：全链路适配（读图、写图、导出、搬迁上线） ----------
const readSrc = (p) => readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

check('导出补齐入口 hydrateAssets / hydrateProjectImages', /export async function hydrateAssets/.test(db) && /export async function hydrateProjectImages/.test(db));
check('导出拆字节保存入口 saveProjectWithImages', /export async function saveProjectWithImages/.test(db));
const saveWith = db.slice(db.indexOf('export async function saveProjectWithImages'), db.indexOf('export async function saveProjectWithImages') + 1600);
check('saveProjectWithImages 同事务写字节+文档+摘要', /IMAGES_STORE_NAME/.test(saveWith) && /PROJECTS_STORE_NAME/.test(saveWith) && /PROJECT_SUMMARIES_STORE_NAME/.test(saveWith));
check('saveProjectWithImages 写入前剥离内联 data', /stripInlineImageData/.test(saveWith));
check('saveProjectWithImages 计入未完成写入', /trackWrite\(/.test(saveWith));

const hookSrc = readSrc('src/hooks/useImageSrc.ts');
check('useImageSrc 先用内联字节再读库', /image\?\.data|image\.data/.test(hookSrc) && /loadImageSrc/.test(hookSrc));
check('useImageSrc 卸载后不再 setState', /alive/.test(hookSrc));

const cacheSrc = readSrc('src/utils/imageCache.ts');
check('imageCache 对同一张图去重并发请求', /inflight/.test(cacheSrc));
check('imageCache 限制常驻数量（LRU）', /MAX_CACHED_IMAGES/.test(cacheSrc));
check('imageCache 可按项目清理', /clearImageCache/.test(cacheSrc));

const thumb = readSrc('src/components/ImageThumbnail.tsx');
const viewer = readSrc('src/components/ImageViewer.tsx');
const mobile = readSrc('src/components/MobileCollector.tsx');
check('缩略图不再直读 image.data', !/src=\{image\.data\}/.test(thumb) && /useImageSrc/.test(thumb));
check('大图查看器不再直读 data', !/src=\{currentImage\.data\}/.test(viewer) && /useImageSrc/.test(viewer));
check('手机端看图不再直读 data', !/src=\{image\.data\}/.test(mobile) && !/src=\{viewingImage\.data\}/.test(mobile) && /useImageSrc/.test(mobile));
check('手机端拍照逐张入库（不重写整份文档）', /addImageToProject/.test(mobile));
check('手机端删图走 removeImageFromProject', /removeImageFromProject/.test(mobile));

const ctx = readSrc('src/context/AppContext.tsx');
check('AppContext 添图走 addImageToProject', /addImageToProject\(/.test(ctx));
check('AppContext 内存态剥离字节（只存引用）', /const \{ data: _inline, \.\.\.reference \}/.test(ctx));
check('AppContext 删图走 removeImageFromProject 并作废缓存', /removeImageFromProject\(/.test(ctx) && /invalidateImage\(/.test(ctx));
check('切换项目释放图片缓存', /clearImageCache\(/.test(ctx));
check('打开项目前触发单项目搬迁', /ensureProjectImagesMigrated\(/.test(ctx));

const lan = readSrc('src/utils/lanImageSink.ts');
check('局域网落库不再整份覆盖（改走 addImageToProject）', /addImageToProject/.test(lan) && !/saveProject\(/.test(lan));

const wordExport = readSrc('src/utils/wordExport.ts');
check('报告导出前补齐图片字节', /hydrateAssets\(/.test(wordExport));
const exportImport = readSrc('src/utils/exportImport.ts');
check('数据包导出前补齐图片字节', /hydrateAssets\(/.test(exportImport));

const list = readSrc('src/components/ProjectList.tsx');
check('列表页后台触发存量搬迁', /migrateInlineImages\(/.test(list));
check('数据包导入/压缩回写走 saveProjectWithImages', /saveProjectWithImages\(/.test(list));
check('批量压缩前先补齐字节', /hydrateProjectImages\(/.test(list));

const panel = readSrc('src/components/StorageSettingsDialog.tsx');
check('存储面板展示搬迁进度', /getImageMigrationProgress/.test(panel));
check('存储面板可手动优化与重试', /handleMigrateImages\(true\)/.test(panel) && /handleMigrateImages\(false\)/.test(panel) && /migrateInlineImages\(force/.test(panel));

// ---------- 输出 ----------
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`);
console.log(`\n${checks.length - failed.length}/${checks.length} 项通过`);
if (failed.length > 0) process.exit(1);
