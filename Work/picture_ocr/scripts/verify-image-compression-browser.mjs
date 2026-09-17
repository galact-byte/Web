import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { startWeb, freePort } from './lan-test-helpers.mjs';
import { connectBrowser } from './browser-test-client.mjs';

// 真实编解码、IndexedDB 与导出回读；仅使用生成的图片和隔离数据目录。
async function runCases(api) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(',');
  const encode = (canvas, mime, quality) => new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  const canvas = document.createElement('canvas'); canvas.width = 3840; canvas.height = 2160;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 42;
  const noise = (width, height) => {
    const pixels = ctx.createImageData(width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let c = 0; c < 3; c++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i + c] = seed >>> 24; }
      pixels.data[i + 3] = 255;
    }
    return pixels;
  };
  ctx.putImageData(noise(3840, 60), 0, 0);
  ctx.fillStyle = 'black'; ctx.font = '16px sans-serif';
  ctx.fillText('服务器截图：时间戳 2026-09-17 12:34:56 / 192.168.1.100', 20, 100);
  const png = await encode(canvas, 'image/png');
  check(png.size > 600 * 1024 && png.size < 1024 * 1024, '夹具应覆盖原 600KB 与新 1MiB 门槛之间');
  for (const mime of ['image/png', 'image/jpeg', 'image/webp']) {
    const blob = mime === 'image/png' ? png : await encode(canvas, mime, 0.9);
    const result = await api.compressImageBlob(blob);
    check(result.blob === blob && !result.changed && !result.failed, `${mime} 小体积图必须原样返回`);
    check(result.width === 3840 && result.height === 2160, `${mime} 保留 4K 分辨率`);
  }
  const clipboard = new DataTransfer(); clipboard.items.add(new File([png], 'screen.png', { type: 'image/png' }));
  const images = await api.readImageFiles(api.getImageFilesFromClipboard({ clipboardData: clipboard }));
  const image = images[0]; const expectedHash = await hash(png);
  check(await hash(api.dataUrlToBlob(image.data)) === expectedHash, '粘贴/选文件入口保留完整字节');
  const doc = api.createProjectDocument({ unitName: '隔离测试', systemName: '截图保真' });
  doc.assets = [{ id: 'asset', name: '服务器', categoryId: doc.categories[0].id, items: [{ id: 'item', label: '日志', required: true, images: [] }] }];
  await api.saveProject(doc);
  await api.addImageToProject(doc.id, 'asset', 'item', image);
  const hydrated = await api.hydrateProjectImages(await api.loadProject(doc.id));
  const saved = hydrated.assets[0].items[0].images[0];
  check(await hash(api.dataUrlToBlob(saved.data)) === expectedHash, '独立图片 store 回读原始字节');
  const compact = await api.compressProjectImages(hydrated);
  check(compact.changedCount === 0 && compact.failedCount === 0 && compact.doc.assets[0].items[0].images[0].data === saved.data, '手动瘦身保留小截图');
  const zip = await api.createDataPackageBlob(doc.meta, doc.categories, hydrated.assets);
  const encrypted = await api.encryptEvidenceBlob(zip, 'compression-test');
  const decoded = await api.decryptEvidenceBlob(encrypted, 'compression-test');
  for (const content of [zip, decoded]) {
    const imported = await api.importDataPackage(content, 'overwrite', [], [], doc.meta);
    check(imported.success, imported.message);
    check(await hash(api.dataUrlToBlob(imported.data.assets[0].items[0].images[0].data)) === expectedHash, 'ZIP/加密包往返保留截图字节');
  }
  const report = await api.createWordReportBlob(doc.meta, doc.categories, hydrated.assets);
  const reportZip = await api.JSZip.loadAsync(report);
  let fullResolutionFound = false;
  for (const entry of reportZip.file(/^word\/media\//)) {
    if (await hash(await entry.async('blob')) === expectedHash) fullResolutionFound = true;
  }
  check(fullResolutionFound, '实际 Word 文件必须嵌入字节完全一致的原图');
  canvas.width = 4096; canvas.height = 3072;
  ctx.putImageData(noise(canvas.width, canvas.height), 0, 0);
  const photo = await encode(canvas, 'image/jpeg', 0.8);
  check(photo.size > 6 * 1024 * 1024, '大照片夹具必须超过 6MiB');
  const compressed = await api.compressImageBlob(photo);
  check(compressed.changed && !compressed.failed && compressed.blob.size < photo.size, '大照片仍成功压缩');
  check(compressed.width === 1920 && compressed.height === 1440, '大照片目标尺寸不变');
  const repeat = await api.compressImageBlob(compressed.blob);
  check(!repeat.changed && !repeat.failed && repeat.blob === compressed.blob, '重复压缩不再劣化');
  const broken = new Blob(['not an image'], { type: 'image/png' });
  const failed = await api.compressImageBlob(broken);
  check(failed.failed && failed.blob === broken && !failed.changed, '解码失败仍保留原始字节');
  return { screenshotBytes: png.size, resolution: '3840x2160', photoBefore: photo.size, photoAfter: compressed.blob.size, wordOriginalBytes: fullResolutionFound };
}

const bundle = (await build({ stdin: { contents: `
  import * as compression from './src/utils/imageCompression';
  import * as files from './src/utils/imageFiles';
  import * as db from './src/utils/db';
  import * as packages from './src/utils/exportImport';
  import * as encryption from './src/utils/evidencePackage';
  import { createWordReportBlob } from './src/utils/wordDocument';
  import JSZip from 'jszip';
  window.runCompressionCases = () => (${runCases.toString()})({ ...compression, ...files, ...db, ...packages, ...encryption, createWordReportBlob, JSZip });
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.png': 'dataurl' } })).outputFiles[0].text;
const require = createRequire(import.meta.url);
for (const platform of ['web', 'desktop']) {
  const profile = await mkdtemp(path.join(tmpdir(), 'picture-ocr-compression-'));
  let host, child, client;
  try {
    if (platform === 'web') host = await startWeb({ built: true });
    const port = await freePort();
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
    child = platform === 'web'
      ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, host.base], { stdio: 'ignore' })
      : spawn(require('electron'), ['scripts/project-list-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
    client = await connectBrowser(port);
    for (let i = 0; i < 100; i++) {
      if (await client.evaluate('!!document.querySelector("#project-list-title")')) break;
      await delay(50);
    }
    assert.ok(await client.evaluate('!!document.querySelector("#project-list-title")'), '应用应启动完成');
    await client.evaluate(bundle);
    const result = await client.evaluate('runCompressionCases()');
    console.log(`PASS ${platform}: 截图保真、粘贴文件读取、存储、手动瘦身、ZIP/加密包往返、Word内嵌原图、大照片压缩、重复压缩、失败保留`, result);
  } finally {
    client?.close();
    if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await host?.stop();
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
