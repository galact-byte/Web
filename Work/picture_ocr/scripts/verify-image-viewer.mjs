import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { startWeb, freePort } from './lan-test-helpers.mjs';
import { connectBrowser } from './browser-test-client.mjs';

const require = createRequire(import.meta.url);
const output = path.resolve('.trellis/.runtime/image-viewer-qa');
await mkdir(output, { recursive: true });
const bundle = (await build({ stdin: { contents: `
  import { createProjectDocument, saveProject } from './src/utils/db';
  window.seedViewer = async () => {
    const doc = createProjectDocument({ systemName: '图片缩放测试' });
    doc.id = 'viewer-test';
    const images = [[1600, 1000], [600, 1600]].map(([width, height], index) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#64748b';
      for (let x = 0; x < width; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y < height; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.fillStyle = '#0f172a'; ctx.font = '36px sans-serif'; ctx.fillText('缩放测试：网格与边缘细节', 32, 70);
      return { id: 'image-' + index, fileName: 'viewer-' + index + '.png', caption: '图片细节与缩放验证', mimeType: 'image/png', data: canvas.toDataURL(), createdAt: 1 };
    });
    doc.assets = [{ id: 'asset', name: '测试资产', categoryId: doc.categories[0].id, items: [{ id: 'item', label: '截图', required: true, images }] }];
    await saveProject(doc);
    location.hash = '/project/viewer-test';
  };`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'iife' })).outputFiles[0].text;

for (const platform of process.argv.includes('--web-only') ? ['web'] : ['web', 'desktop']) {
  let host, client, child;
  const profile = await mkdtemp(path.join(tmpdir(), 'picture-ocr-viewer-'));
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await client.evaluate(expression)) return; await delay(50); }
    throw new Error(`等待超时：${expression}`);
  };
  const click = async label => {
    await client.evaluate(`document.querySelector('[role="dialog"] button[aria-label=${JSON.stringify(label)}]').click()`);
    await delay(80);
  };
  const imageRect = () => client.evaluate(`(() => { const r = document.querySelector('[role="dialog"] img').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const key = async (key, code, virtual) => {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual });
    await delay(80);
  };
  try {
    if (platform === 'web') host = await startWeb({ built: true });
    const port = await freePort();
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
    child = platform === 'web'
      ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, host.base], { stdio: 'ignore' })
      : spawn(require('electron'), ['scripts/project-list-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
    client = await connectBrowser(port);
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await until('!!document.querySelector("#project-list-title")');
    await client.evaluate(bundle); await client.evaluate('seedViewer()');
    await until(`!!document.querySelector('img[alt="viewer-0.png"]')`);
    await client.evaluate(`document.querySelector('button[title="放大查看"]').focus(); document.querySelector('button[title="放大查看"]').click()`);
    await until('!!document.querySelector("[role=dialog] img")');
    const fit = await imageRect();
    const mouse = (type, x, y, extra = {}) => client.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
    const wheel = async deltaY => {
      await mouse('mouseWheel', 800, 400, { deltaX: 0, deltaY }); await delay(100);
    };
    await wheel(-200);
    assert.ok((await imageRect()).width > fit.width * 1.1, '滚轮应放大图片');
    assert.equal(await client.evaluate(`!!document.querySelector('[role=dialog] button[aria-label="放大"]')`), false, '不添加缩放按钮');
    const scaled = await imageRect();
    // 局部放大跟随鼠标，而不是每次跳回图片中心。
    const beforeAnchor = { x: (800 - fit.x) / fit.width, y: (400 - fit.y) / fit.height };
    assert.ok(Math.abs((800 - scaled.x) / scaled.width - beforeAnchor.x) < 0.01);
    assert.ok(Math.abs((400 - scaled.y) / scaled.height - beforeAnchor.y) < 0.01);
    await mouse('mousePressed', 750, 400, { button: 'left', clickCount: 1 });
    await mouse('mouseMoved', 850, 470, { button: 'left', buttons: 1 });
    await mouse('mouseReleased', 850, 470, { button: 'left', clickCount: 1 });
    await delay(100);
    const moved = await imageRect();
    assert.ok(moved.x > scaled.x + 50 && moved.y > scaled.y + 30, '放大后可以拖动');
    assert.ok(await client.evaluate('!!document.querySelector("[role=dialog]")'), '拖动不会关闭预览');
    const doubleClick = async () => {
      await mouse('mousePressed', 750, 400, { button: 'left', clickCount: 2 });
      await mouse('mouseReleased', 750, 400, { button: 'left', clickCount: 2 }); await delay(80);
    };
    await doubleClick();
    assert.ok(Math.abs((await imageRect()).width - fit.width) < 1, '双击恢复适应窗口');
    for (let i = 0; i < 6; i++) await wheel(-200);
    assert.ok(Math.abs((await imageRect()).width / fit.width - 5) < 0.01, '放大上限 500%');
    await mouse('mousePressed', 750, 400, { button: 'left', clickCount: 1 });
    await mouse('mouseMoved', 5000, 5000, { button: 'left', buttons: 1 });
    await mouse('mouseReleased', 5000, 5000, { button: 'left', clickCount: 1 }); await delay(80);
    assert.ok(await client.evaluate('!!document.querySelector("[role=dialog]")'), '越界拖动释放不会误关');
    const edge = await imageRect(); assert.ok(edge.x <= 17 && edge.y <= 65, '不能把图片拖出可视区');
    for (let i = 0; i < 12; i++) await wheel(200);
    assert.ok(Math.abs((await imageRect()).width / fit.width - 0.25) < 0.01, '缩小下限 25%');
    await key('0', 'Digit0', 48);
    assert.ok(Math.abs((await imageRect()).width - fit.width) < 1);
    console.log(`PASS ${platform}: 滚轮锚点、缩放边界、拖动限位、越界释放、双击/键盘复位`);

    await wheel(-200); await key('ArrowRight', 'ArrowRight', 39);
    await until(`document.querySelector('[role=dialog] img')?.alt === 'viewer-1.png'`);
    await until(`document.querySelector('[role=dialog] p')?.textContent.startsWith('100%')`);
    const portrait = await imageRect(); assert.ok(portrait.height > portrait.width);
    await click('上一张');
    await until(`document.querySelector('[role=dialog] img')?.alt === 'viewer-0.png'`);
    await wheel(-200); await key('Escape', 'Escape', 27);
    assert.equal(await client.evaluate('!!document.querySelector("[role=dialog]")'), false);
    assert.equal(await client.evaluate('document.body.style.overflow'), '');
    assert.equal(await client.evaluate('document.activeElement.title'), '放大查看');
    await client.evaluate('document.activeElement.click()');
    await until(`document.querySelector('[role=dialog] p')?.textContent.startsWith('100%')`);
    assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-label")'), '关闭图片预览');
    await key('Tab', 'Tab', 9); await key('Tab', 'Tab', 9);
    assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-label")'), '关闭图片预览', 'Tab 不离开预览');
    console.log(`PASS ${platform}: 切图/重开复位、Escape、焦点与页面滚动恢复`);

    for (const width of [375, 768, 1440]) {
      await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await delay(100);
      const layout = await client.evaluate(`(() => { const dialog = document.querySelector('[role=dialog]'); return { scroll: dialog.scrollWidth, width: dialog.getBoundingClientRect().width, inner: innerWidth, pageScroll: document.documentElement.scrollWidth }; })()`);
      assert.ok(layout.scroll <= layout.inner && Math.abs(layout.width - layout.inner) < 1, `预览自身不产生横向溢出：${JSON.stringify(layout)}`);
      assert.ok(await client.evaluate(`Array.from(document.querySelectorAll('[role=dialog] button')).every(button => { const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; })`));
      const shot = await client.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `${platform}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    await client.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: false }); await delay(100);
    await mouse('mouseWheel', 180, 280, { deltaX: 0, deltaY: -200 }); await delay(100);
    const zoomedShot = await client.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `${platform}-zoomed.png`), Buffer.from(zoomedShot.data, 'base64'));
    await click('关闭图片预览');
    await client.evaluate(`document.querySelector('button[title="放大查看"]').click()`); await delay(100);
    await mouse('mousePressed', 5, 100, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', 5, 100, { button: 'left', clickCount: 1 }); await delay(100);
    assert.equal(await client.evaluate('!!document.querySelector("[role=dialog]")'), false, '空白遮罩仍可关闭');
    console.log(`PASS ${platform}: 375/768/1440px 布局、控件可达、关闭按钮及空白遮罩`);
  } catch (error) {
    if (client) {
      const shot = await client.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) await writeFile(path.join(output, `${platform}-failure.png`), Buffer.from(shot.data, 'base64'));
    }
    throw error;
  } finally {
    client?.close();
    if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await host?.stop();
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
