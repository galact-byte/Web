// 通用隔离双端用例执行器：esbuild 打包用例入口 → 隔离 Chrome profile 与独立 Electron 入口各跑一轮。
// 用例模块须导出 async run(): { results: [{ name, ok }] }。不接触用户真实数据目录。
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export async function runBrowserCases(entry, { platforms = ['web', 'desktop'], timeoutMs = 120000 } = {}) {
  const only = process.argv.includes('--web-only') ? ['web'] : process.argv.includes('--desktop-only') ? ['desktop'] : platforms;
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', globalName: 'cases', platform: 'browser' });
  let receive;
  const server = createServer((req, res) => {
    if (req.url === '/result') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => { res.end('ok'); receive(JSON.parse(body)); });
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<meta charset="utf-8"><script>${bundle.outputFiles[0].text}</script><script>window.startDiagnosis = async () => { let result; try { result = await cases.run(); } catch(e) { result = {results:[{name:String(e && e.stack || e),ok:false}]}; } await fetch('/result', {method:'POST',body:JSON.stringify(result)}); }; ${req.url === '/web' ? 'startDiagnosis();' : ''}</script>`);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let failed = false;
  try {
    for (const platform of only) {
      const profile = mkdtempSync(path.join(tmpdir(), 'picture-ocr-cases-'));
      const url = `http://127.0.0.1:${server.address().port}/${platform}`;
      let timer;
      const result = new Promise((resolve, reject) => {
        receive = resolve;
        timer = setTimeout(() => reject(new Error(`${platform} 测试超时`)), timeoutMs);
      });
      const env = { ...process.env, DIAG_PROFILE: profile, DIAG_URL: url };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = platform === 'web'
        ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, url], { stdio: 'ignore' })
        : spawn(require('electron'), ['scripts/diagnosis-electron.cjs'], { env, stdio: 'ignore' });
      const exit = new Promise(resolve => child.once('exit', resolve));
      try {
        const report = await result;
        for (const entry of report.results) console.log(`${platform} ${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}`);
        failed ||= report.results.some(entry => !entry.ok) || report.results.length === 0;
      } finally {
        clearTimeout(timer);
        child.kill();
        await exit;
        rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      }
    }
  } finally { server.closeAllConnections(); server.close(); }
  if (failed) process.exitCode = 1;
}
