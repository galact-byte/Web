import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.resolve('.trellis/.runtime/project-list-qa');
require('node:fs').mkdirSync(output, { recursive: true });
const bundle = (await build({ entryPoints: ['scripts/project-list-browser-cases.mjs'], bundle: true, write: false, format: 'iife', globalName: 'cases', platform: 'browser' })).outputFiles[0].text + '\nwindow.cases = cases;';
let webLanEnabled = false;
let webLanSnapshot = null;
let webLanRunning = false;
let webUpload = null;
let confirmUpload;
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/control/') && webLanEnabled) {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    const operation = req.url.slice('/api/control/'.length);
    if (operation === 'start') { webLanSnapshot = payload.snapshot; webLanRunning = true; }
    if (operation === 'update') webLanSnapshot = payload.snapshot;
    if (operation === 'stop') webLanRunning = false;
    if (operation === 'confirm') { webUpload = null; confirmUpload?.(payload); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(operation === 'pending' ? { upload: webUpload } : { running: webLanRunning, url: webLanRunning ? `http://127.0.0.1:${server.address().port}/#/lan/qa` : null, addresses: [{ name: '隔离测试', address: '127.0.0.1' }] }));
    return;
  }
  const relative = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve('dist', `.${relative === '/' ? '/index.html' : relative}`);
  if (!file.startsWith(path.resolve('dist') + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function connect(port) {
  for (let n = 0; n < 150; n++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      const target = targets.find(target => target.type === 'page' && (target.url.startsWith('file:') || target.url.startsWith('http:')));
      if (target) {
        const socket = new WebSocket(target.webSocketDebuggerUrl); const pending = new Map(); let id = 0;
        socket.addEventListener('message', event => { const message = JSON.parse(event.data); const result = pending.get(message.id); if (!result) return; pending.delete(message.id); message.error ? result.reject(new Error(message.error.message)) : result.resolve(message.result); });
        socket.addEventListener('close', () => { for (const result of pending.values()) result.reject(new Error('测试浏览器连接已关闭')); pending.clear(); });
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
        return { send, close: () => socket.close(), evaluate: async expression => {
          const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
          return result.result.value;
        } };
      }
    } catch { /* 浏览器尚未启动。 */ }
    await delay(100);
  }
  throw new Error('无法连接隔离浏览器');
}
const report = [];
try {
  for (const platform of (process.argv.includes('--web-only') ? ['web'] : ['web', 'desktop'])) {
    const profile = mkdtempSync(path.join(tmpdir(), 'picture-ocr-project-list-'));
    // 仅测试进程使用随机调试端口，正式 Web 服务固定端口不变。
    const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve)); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
    const child = platform === 'web'
      ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`], { stdio: 'ignore' })
      : spawn(require('electron'), ['scripts/project-list-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
    let client;
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timeout = setTimeout(() => child.kill(), 120000);
    const pass = name => { console.log(`${platform} PASS ${name}`); report.push({ platform, name, ok: true }); };
    try {
      client = await connect(port);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.enable');
      await client.evaluate(bundle);
      await client.evaluate('cases.until(() => document.querySelector("#project-list-title"), "初始页面")');
      await client.evaluate('cases.seed()');
      // 新文档执行前安装读计数，验证生产首屏仅加载摘要。
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle + '\nwindow.listReads = cases.instrument();' });
      await client.send('Page.reload', { ignoreCache: true });
      await delay(400);
      await client.evaluate('cases.until(() => document.querySelectorAll("[data-group-id]").length === 4, "夹具加载")');
      assert.deepEqual(await client.evaluate('window.listReads'), { documents: 0, images: 0 });
      pass('生产首屏只读摘要，无项目文档/图片读取');
      if (platform === 'web') { assert.equal(await client.evaluate('!!cases.button("手机采集")'), false); pass('无桥网页不显示手机采集'); }
      for (const name of ['core', 'mutations', 'exportAndImport', 'failedLoad']) pass(await client.evaluate(`cases.${name}()`));
      for (const width of [375, 768, 1440]) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        pass(`${width}px ${await client.evaluate('cases.layout()')}`);
        const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(output, `${platform}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      }
      await client.evaluate('document.querySelector("[data-system-id] summary").focus()');
      const key = async (key, code, virtual) => { await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, ...(key === 'Enter' ? { text: '\r' } : {}) }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual }); };
      await key('Enter', 'Enter', 13); await delay(100);
      assert.equal(await client.evaluate('!!document.querySelector("details[open]")'), true);
      await key('Tab', 'Tab', 9); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '编辑');
      await key('Escape', 'Escape', 27); await delay(60);
      assert.equal(await client.evaluate('document.activeElement.tagName'), 'SUMMARY');
      assert.equal(await client.evaluate('!!document.querySelector("details[open]")'), false);
      pass('真实 Enter/Tab/Escape 按键与焦点恢复');
      if (platform === 'web') {
        webLanEnabled = true;
        await client.send('Page.reload', { ignoreCache: true }); await delay(400);
      }
      for (const scope of ['group', 'system']) {
        const url = await client.evaluate(`cases.startLan('${scope}')`);
        let snapshot;
        if (platform === 'web') snapshot = webLanSnapshot;
        else {
          const base = new URL(url); const token = base.hash.split('/').pop();
          snapshot = await fetch(`${base.origin}/api/session?token=${token}`).then(r => r.json());
        }
        assert.deepEqual(snapshot.systems.map(system => system.projectId).sort(), scope === 'group' ? ['g1', 'g2'] : ['g1']);
        assert.equal(snapshot.groupId, 'multi');
        if (scope === 'group') {
          if (platform === 'web') {
            const confirmed = new Promise(resolve => { confirmUpload = resolve; });
            webUpload = { requestId: 'qa-upload', projectId: 'g2', assetId: 'asset', itemId: 'item', image: { fileName: 'qa.png', mimeType: 'image/png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' } };
            assert.equal((await confirmed).success, true);
          } else {
            const base = new URL(url); const token = base.hash.split('/').pop();
            const response = await fetch(`${base.origin}/api/upload?token=${token}&projectId=g2&assetId=asset&itemId=item`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-file-name': 'qa.png' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
            assert.equal(response.status, 201, await response.text());
          }
          await client.evaluate('cases.verifyLanImage()');
        }
        await client.evaluate('cases.stopLan()');
        pass(`${scope} 采集范围${scope === 'group' ? '、上传写入正确系统与计数更新' : '仅包含所选系统'}`);
      }
      for (const kind of ['independent', 'groups']) {
        await client.evaluate(`cases.prepareDefault('${kind}')`);
        await client.send('Page.reload', { ignoreCache: true }); await delay(400);
        await client.evaluate('cases.until(() => document.querySelector("[aria-busy=\\"false\\"]"), "默认页签加载")');
        assert.equal(await client.evaluate('document.querySelector("#project-list-title").textContent'), kind === 'independent' ? '独立系统' : '多系统项目');
        pass(kind === 'independent' ? '仅有独立系统时默认独立页签' : '空库默认项目页签及空态');
      }
    } catch (error) {
      report.push({ platform, ok: false, name: error.stack });
      if (client) { const image = await client.send('Page.captureScreenshot', { format: 'png' }).catch(() => null); if (image) writeFileSync(path.join(output, `${platform}-failure.png`), Buffer.from(image.data, 'base64')); }
      throw error;
    } finally {
      clearTimeout(timeout); client?.close(); child.kill(); await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  }
} finally {
  server.closeAllConnections(); server.close();
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
}
