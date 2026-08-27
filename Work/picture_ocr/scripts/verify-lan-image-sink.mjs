/* 无测试框架：用 esbuild 现场转译纯函数，以 Node assert 验证局域网组级落库与快照映射的核心逻辑。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadModule(relativeSource) {
  const outfile = path.join(root, `.tmp-verify-${path.basename(relativeSource, '.ts')}.mjs`);
  await build({
    entryPoints: [path.join(root, relativeSource)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  try {
    return await import(`file://${outfile}?t=${Date.now()}`);
  } finally {
    fs.rmSync(outfile, { force: true });
  }
}

function makeImage(id) {
  return { id, fileName: `${id}.png`, data: `data:image/png;base64,AAAA-${id}`, caption: '', uploadedAt: '2026-01-01T00:00:00.000Z' };
}

function makeDoc() {
  return {
    id: 'system-1',
    groupId: 'group-1',
    meta: { projectCode: '', projectName: '项目甲', unitName: '单位', systemName: '系统一', reportDate: '' },
    categories: [{ id: 'cat-1', name: '分类一', type: 'checklist', order: 0, defaultItems: [] }],
    assets: [{
      id: 'asset-1',
      name: '资产一',
      categoryId: 'cat-1',
      items: [
        { id: 'item-1', label: '检查项一', required: true, fromTemplateId: null, images: [makeImage('img-existing')] },
        { id: 'item-2', label: '检查项二', required: false, fromTemplateId: null, images: [] },
      ],
    }],
    createdAt: 1,
    updatedAt: 1,
  };
}

const { applyLanImageToDocument } = await loadModule('src/utils/lanImageSink.ts');
const { mapDocumentToSystemSnapshot } = await loadModule('src/utils/lanGroupSnapshot.ts');

// 1. 目标系统不存在（doc 为 null）应报错。
assert.throws(() => applyLanImageToDocument(null, { assetId: 'asset-1', itemId: 'item-2', image: makeImage('x') }), /系统/);

// 2. 资产缺失应报错。
assert.throws(() => applyLanImageToDocument(makeDoc(), { assetId: 'nope', itemId: 'item-2', image: makeImage('x') }), /资产|检查项|结构/);

// 3. 检查项缺失应报错。
assert.throws(() => applyLanImageToDocument(makeDoc(), { assetId: 'asset-1', itemId: 'nope', image: makeImage('x') }), /资产|检查项|结构/);

// 4. 重复 image.id 应视为已存在，不改变文档。
{
  const doc = makeDoc();
  const result = applyLanImageToDocument(doc, { assetId: 'asset-1', itemId: 'item-1', image: makeImage('img-existing') });
  assert.equal(result.changed, false);
  assert.equal(result.doc.assets[0].items[0].images.length, 1);
}

// 5. 新图片应 append 到目标检查项，并刷新 updatedAt；不改动其他项，且不产生原对象突变。
{
  const doc = makeDoc();
  const before = doc.assets[0].items[1].images.length;
  const result = applyLanImageToDocument(doc, { assetId: 'asset-1', itemId: 'item-2', image: makeImage('img-new') });
  assert.equal(result.changed, true);
  assert.equal(result.doc.assets[0].items[1].images.length, before + 1);
  assert.equal(result.doc.assets[0].items[1].images.at(-1).id, 'img-new');
  assert.ok(result.doc.updatedAt >= doc.updatedAt);
  // 不可突变原始文档。
  assert.equal(doc.assets[0].items[1].images.length, before);
}

// 6. 系统快照映射：产出 projectId/title/分类/资产（含 imageCount），且不携带图片 data。
{
  const snapshot = mapDocumentToSystemSnapshot(makeDoc());
  assert.equal(snapshot.projectId, 'system-1');
  assert.equal(snapshot.title, '系统一');
  assert.equal(snapshot.categories[0].name, '分类一');
  assert.equal(snapshot.assets[0].items[0].imageCount, 1);
  assert.equal(snapshot.assets[0].items[1].imageCount, 0);
  const serialized = JSON.stringify(snapshot);
  assert.ok(!serialized.includes('base64'), '组快照不应包含图片 data');
}

console.log('局域网组级落库与快照映射验证通过：越权与缺失报错、去重、append 不突变、快照仅含计数。');
