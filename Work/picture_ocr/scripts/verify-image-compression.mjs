/* 无测试框架：用 esbuild 现场转译，以 Node assert 验证图片压缩的纯决策逻辑（尺寸/跳过/字节估算）。 */
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

const mod = await loadModule('src/utils/imageCompression.ts');
const { computeTargetSize, estimateDataUrlBytes, shouldSkipCompression, DEFAULT_COMPRESS_OPTIONS } = mod;

// computeTargetSize：只缩不放，长边等比缩到 maxEdge
{
  const portrait = computeTargetSize(3072, 4096, 1920);
  assert.deepEqual(portrait, { width: 1440, height: 1920, scaled: true }, '竖图应按高度缩到 1920');

  const landscape = computeTargetSize(4032, 3024, 1920);
  assert.deepEqual(landscape, { width: 1920, height: 1440, scaled: true }, '横图应按宽度缩到 1920');

  const small = computeTargetSize(1615, 970, 1920);
  assert.deepEqual(small, { width: 1615, height: 970, scaled: false }, '未超长边不缩放');

  const exact = computeTargetSize(1920, 1080, 1920);
  assert.equal(exact.scaled, false, '恰好等于长边不缩放');
}

// estimateDataUrlBytes：从 base64 估算解码字节
{
  // "AAAA" -> 4 base64 chars, no padding -> 3 bytes
  assert.equal(estimateDataUrlBytes('data:image/png;base64,AAAA'), 3, '4 字符无填充=3 字节');
  // "AAA=" -> 1 padding -> 2 bytes
  assert.equal(estimateDataUrlBytes('data:image/jpeg;base64,AAA='), 2, '1 个 = 填充=2 字节');
  // "AA==" -> 2 padding -> 1 byte
  assert.equal(estimateDataUrlBytes('data:image/jpeg;base64,AA=='), 1, '2 个 = 填充=1 字节');
  assert.equal(estimateDataUrlBytes(''), 0, '空串=0');
  // 无逗号时按整串计算
  assert.equal(estimateDataUrlBytes('AAAA'), 3, '无逗号也可估算');
}

// shouldSkipCompression：小图跳过，大尺寸或大体积不跳过
{
  const opts = DEFAULT_COMPRESS_OPTIONS;
  // 小截图：尺寸小 + 体积小 -> 跳过
  assert.equal(shouldSkipCompression({ width: 1615, height: 970, bytes: 100 * 1024 }, opts), true, '小截图应跳过');
  // 12MP 手机照：尺寸超标 -> 不跳过
  assert.equal(shouldSkipCompression({ width: 4096, height: 3072, bytes: 8 * 1024 * 1024 }, opts), false, '大照片不跳过');
  // 尺寸达标但体积超阈值（大 PNG）-> 不跳过，仍重编码
  assert.equal(shouldSkipCompression({ width: 1600, height: 900, bytes: 2 * 1024 * 1024 }, opts), false, '大体积小尺寸仍压缩');
  // 边界：恰好等于阈值体积 -> 不跳过（< 才跳过）
  assert.equal(shouldSkipCompression({ width: 800, height: 600, bytes: opts.skipBelowBytes }, opts), false, '等于阈值不跳过');
  // 边界：尺寸恰好等于 maxEdge 且体积略低 -> 跳过
  assert.equal(shouldSkipCompression({ width: 1920, height: 1080, bytes: opts.skipBelowBytes - 1 }, opts), true, '达标且体积略低应跳过');
}

console.log('verify-image-compression: 所有断言通过');
