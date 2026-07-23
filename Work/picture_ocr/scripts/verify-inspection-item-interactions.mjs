import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-ocr-inspection-items-'));
const sourceDirectory = path.join(temporaryDirectory, 'src');

try {
  for (const relativePath of ['context/appReducer.ts', 'data/defaults.ts', 'types/index.ts']) {
    const destination = path.join(sourceDirectory, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, 'src', relativePath), destination);
  }

  execFileSync(process.execPath, [
    path.join(projectRoot, 'node_modules/typescript/lib/tsc.js'),
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--outDir', path.join(temporaryDirectory, 'out'),
    '--skipLibCheck',
    path.join(sourceDirectory, 'context/appReducer.ts'),
  ], { stdio: 'inherit' });

  const require = createRequire(import.meta.url);
  const { appReducer, createInitialState } = require(path.join(temporaryDirectory, 'out/context/appReducer.js'));
  const state = {
    ...createInitialState(),
    assets: [{
      id: 'asset-1',
      name: '测试资产',
      categoryId: 'cat-physical',
      items: [
        { id: 'item-1', label: '检查项一', required: true, fromTemplateId: null, images: [] },
        { id: 'item-2', label: '检查项二', required: false, fromTemplateId: null, images: [] },
        { id: 'item-3', label: '检查项三', required: true, fromTemplateId: null, images: [] },
      ],
    }],
  };

  const added = appReducer(state, { type: 'ADD_ITEM', payload: { assetId: 'asset-1', label: '新项' } });
  assert.equal(added.assets[0].items[0].label, '新项', '手动新增检查项应插入最前面');
  assert.equal(added.assets[0].items[0].required, true, '手动新增检查项应默认为必填');

  const reordered = appReducer(state, {
    type: 'REORDER_ITEMS',
    payload: { assetId: 'asset-1', itemIds: ['item-3', 'item-1', 'item-2'] },
  });
  assert.deepEqual(reordered.assets[0].items.map(({ id }) => id), ['item-3', 'item-1', 'item-2']);
  assert.equal(appReducer(state, {
    type: 'REORDER_ITEMS',
    payload: { assetId: 'asset-1', itemIds: ['item-1', 'item-2'] },
  }), state, '不完整的排序 ID 列表不得改变领域状态');
  assert.equal(appReducer(state, {
    type: 'REORDER_ITEMS',
    payload: { assetId: 'asset-1', itemIds: ['item-1', 'item-1', 'item-3'] },
  }), state, '重复的排序 ID 列表不得改变领域状态');
  assert.equal(appReducer(state, {
    type: 'REORDER_ITEMS',
    payload: { assetId: 'asset-1', itemIds: ['item-1', 'item-2', 'unknown-item'] },
  }), state, '包含未知项的排序 ID 列表不得改变领域状态');

  const contentAreaSource = fs.readFileSync(path.join(projectRoot, 'src/components/ContentArea.tsx'), 'utf8');
  const itemCardSource = fs.readFileSync(path.join(projectRoot, 'src/components/ItemCard.tsx'), 'utf8');
  assert.match(contentAreaSource, /调整顺序/, '普通模式必须提供排序入口');
  assert.match(contentAreaSource, /完成排序/, '排序模式必须提供明确退出按钮');
  assert.match(itemCardSource, /onPointerDown/, '排序必须从 Pointer Events 手柄发起');
  assert.match(itemCardSource, /data-item-id/, '排序卡必须暴露有效投放目标');
  assert.doesNotMatch(itemCardSource, /更多操作|⋮/, '不得保留无功能的更多操作图标');

  const sortingVariant = itemCardSource.match(/const SortingItemCard[\s\S]*?\n\);\n\nconst NormalItemCard/)?.[0] ?? '';
  assert.ok(sortingVariant, 'ItemCard 必须有独立的排序变体');
  assert.doesNotMatch(sortingVariant, /UploadZone/, '排序变体不得挂载上传区');
  assert.match(sortingVariant, /touch-none/, '拖拽手柄必须阻止浏览器接管触摸滚动');

  console.log('检查项交互验证通过：新增默认必填置顶、完整排序校验与排序模式源码契约均符合预期。');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
