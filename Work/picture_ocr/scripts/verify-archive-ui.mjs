// 归档/存储提醒界面回归：先 npm run build，再在隔离 Chrome（dist + 模拟本机控制接口）与正式 Electron 入口各跑一轮。
// 截图写到 .trellis/.runtime/archive-ui-qa/ 供人工比对样式。
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve('.trellis/.runtime/archive-ui-qa');
mkdirSync(output, { recursive: true });
if (!existsSync('dist/index.html')) throw new Error('请先 npm run build');

const bundle = (await build({ entryPoints: ['scripts/archive-ui-cases.mjs'], bundle: true, write: false, format: 'iife', globalName: 'cases', platform: 'browser', loader: { '.png': 'dataurl' } })).outputFiles[0].text + '\nwindow.cases = cases;';
const GB = 1024 * 1024 * 1024;
let diskHeaders = [];
const server = createServer((req, res) => {
  if (req.url === '/api/control/disk-free') {
    diskHeaders.push(req.headers['x-evidence-control']);
    res.setHeader('Content-Type', 'application/json');
    // 低于默认紧急线 3GB → Web 端提醒为紧急。
    res.end(JSON.stringify({ drive: 'C:', freeBytes: 1 * GB, totalBytes: 100 * GB }));
    return;
  }
  const relative = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve('dist', `.${relative === '/' ? '/index.html' : relative}`);
  if (!file.startsWith(path.resolve('dist') + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

async function connect(port) {
  for (let n = 0; n < 150; n++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const target = targets.find((t) => t.type === 'page' && (t.url.startsWith('file:') || t.url.startsWith('http:')));
      if (target) {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const pending = new Map();
        let id = 0;
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);
          const entry = pending.get(message.id);
          if (!entry) return;
          pending.delete(message.id);
          if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
        });
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        const send = (method, params = {}) => new Promise((resolve, reject) => {
          const requestId = ++id;
          const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`浏览器命令超时：${method} ${params.expression?.slice(0, 80) ?? ''}`)); }, 60000);
          pending.set(requestId, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
          socket.send(JSON.stringify({ id: requestId, method, params }));
        });
        const evaluate = async (expression) => {
          const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
          return result.result.value;
        };
        return { send, evaluate, close: () => socket.close() };
      }
    } catch { /* 尚未启动 */ }
    await delay(100);
  }
  throw new Error('无法连接隔离浏览器');
}

let failed = false;
const platforms = process.argv.includes('--web-only') ? ['web'] : process.argv.includes('--desktop-only') ? ['desktop'] : ['web', 'desktop'];
try {
  for (const platform of platforms) {
    const profile = mkdtempSync(path.join(tmpdir(), 'picture-ocr-archive-ui-'));
    const archiveDir = mkdtempSync(path.join(tmpdir(), 'picture-ocr-archive-out-'));
    const reservation = createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const env = { ...process.env, ARCHIVE_UI_PROFILE: profile, ARCHIVE_UI_DIR: archiveDir };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = platform === 'web'
      ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`], { stdio: 'ignore' })
      : spawn(require('electron'), ['scripts/archive-ui-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
    const exited = new Promise((resolve) => child.once('exit', resolve));
    const killer = setTimeout(() => child.kill(), 180000);
    let client;
    const pass = (name) => console.log(`${platform} PASS ${name}`);
    const shot = async (name) => {
      const image = await client.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(output, `${platform}-${name}.png`), Buffer.from(image.data, 'base64'));
    };
    // 等到应用文档真正提交并加载完：导航途中执行的表达式会落进随后被替换的上下文，负载高时表现为 cases 未定义。
    const waitForDocument = async (label) => {
      for (let n = 0; n < 300; n++) {
        const ready = await client.evaluate('!window.__archiveUiOldDocument && /^(http|file):/.test(location.href) && document.readyState === "complete" && typeof cases !== "undefined"').catch(() => false);
        if (ready) return;
        await delay(100);
      }
      throw new Error(`等待页面加载超时：${label}`);
    };
    const reload = async () => {
      await client.evaluate('window.__archiveUiOldDocument = true');
      await client.send('Page.reload', { ignoreCache: true });
      await waitForDocument('重新加载');
      await client.evaluate('cases.until(() => document.querySelector("[aria-busy=\\"false\\"]"), "列表加载")');
      if (platform === 'web') await client.evaluate('cases.installWebPicker()');
    };
    try {
      client = await connect(port);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.enable');
      // 先登记新文档注入，首个文档若在此后才提交也能拿到 cases；已提交的当前文档再补一次。
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle });
      await client.evaluate(`if (typeof cases === "undefined") {\n${bundle}\n}`).catch(() => undefined);
      await waitForDocument('首次打开');
      await client.evaluate('cases.until(() => document.querySelector("#project-list-title"), "初始页面")');
      await client.evaluate('cases.seed()');
      await reload();
      await client.evaluate('cases.until(() => document.querySelector("[data-storage-reminder]"), "存储提醒条")');
      await shot('reminder');
      pass(await client.evaluate(`cases.reminder('${platform}')`));
      if (platform === 'desktop') {
        await reload();
        pass(await client.evaluate('cases.afterSnoozeReload()'));
        await reload();
      } else {
        if (!diskHeaders.length || diskHeaders.some((h) => h !== '1')) throw new Error(`磁盘剩余请求未带控制标识：${diskHeaders}`);
        pass('Web 磁盘剩余请求带控制标识');
      }
      pass(await client.evaluate('cases.openFromBanner()'));
      await shot('dialog-1440');
      await client.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: false });
      await delay(200);
      await shot('dialog-375');
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      pass(await client.evaluate(`cases.runArchive('${platform}')`));
      await shot('done');
      if (platform === 'desktop') {
        const files = readdirSync(archiveDir).filter((name) => name.endsWith('.zip'));
        if (files.length !== 2 || !files.every((name) => /^归档_归档测试单位_.+_\d{8}-\d{4}\.zip$/.test(name))) throw new Error(`桌面归档目录文件：${files}`);
        pass(`桌面归档文件落盘：${files.join('、')}`);
      }
      pass(await client.evaluate('cases.listAfterArchive()'));
      await shot('list-archived');
      pass(await client.evaluate('cases.bypassByUrl()'));
      let fileArg = 'null';
      if (platform === 'desktop') {
        const info = await client.evaluate('(async () => { const r = indexedDB.open("evidence-collector-db"); await new Promise(res => r.onsuccess = res); const c = r.result; const g = c.transaction("projects").objectStore("projects").get("old1"); await new Promise(res => g.onsuccess = res); c.close(); return g.result.archive.fileName; })()');
        fileArg = JSON.stringify(readFileSync(path.join(archiveDir, info)).toString('base64'));
      }
      pass(await client.evaluate(`cases.restore(${fileArg})`));
      pass(await client.evaluate(`cases.settings('${platform}')`));
      await client.evaluate('document.querySelector("[data-archive-section]")?.scrollIntoView({ block: "start" })');
      await delay(400);
      await shot('settings-archive');
      pass(await client.evaluate('cases.settingsOpenArchive()'));
      pass(await client.evaluate('cases.closeArchive()'));
      if (platform === 'web') pass(await client.evaluate('cases.unsupportedWeb()'));
    } catch (error) {
      failed = true;
      console.error(`${platform} FAIL ${error.stack}`);
      if (client) {
        console.error(await client.evaluate('({ step: window.archiveUiStep, text: document.body.innerText.slice(-1500) })').catch(() => '无法读取页面'));
        await shot('failure').catch(() => undefined);
      }
    } finally {
      clearTimeout(killer);
      client?.close();
      child.kill();
      await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      rmSync(archiveDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  }
} finally {
  server.closeAllConnections();
  server.close();
}
if (failed) process.exitCode = 1;
