// 校验「未完成写入拦截」链路（P0 止血）：
// 1) 纯逻辑 pendingWrites 计数/订阅用真实调用测试，编译 src/utils/pendingWrites.ts 后 import；
// 2) db.ts 契约：所有会丢用户数据的写入路径都经 trackWrite 计入未完成写入；
// 3) 渲染进程契约：beforeunload 在有未完成写入时阻止关闭，并把状态同步给桌面端主进程；
// 4) Electron 契约：主进程在 close 时拦截未完成写入，提供「仍然退出」逃生阀，避免永久卡住。
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

// ---------- 1) 纯逻辑真实调用 ----------
const outDir = mkdtempSync(path.join(tmpdir(), 'pending-writes-'));
try {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js'),
      path.join(root, 'src', 'utils', 'pendingWrites.ts'),
      path.join(root, 'src', 'vite-env.d.ts'),
      '--outDir', outDir,
      '--module', 'esnext',
      '--target', 'es2020',
      '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' }
  );
  const mod = await import(pathToFileURL(path.join(outDir, 'pendingWrites.js')).href);

  // 初始为空闲
  check('初始无未完成写入', mod.hasPendingWrites() === false && mod.getPendingWriteCount() === 0);

  // 追踪期间计数上升，结束后归零
  let resolveA;
  const a = new Promise((r) => { resolveA = r; });
  const trackedA = mod.trackWrite(a);
  check('写入进行中 hasPendingWrites=true', mod.hasPendingWrites() === true && mod.getPendingWriteCount() === 1);

  // 并发写入累加
  let resolveB;
  const b = new Promise((r) => { resolveB = r; });
  const trackedB = mod.trackWrite(b);
  check('并发写入计数累加', mod.getPendingWriteCount() === 2);

  // 订阅收到变化
  const seen = [];
  const unsubscribe = mod.subscribePendingWrites((n) => seen.push(n));
  resolveA();
  await trackedA;
  check('完成一笔后计数下降', mod.getPendingWriteCount() === 1);
  check('订阅者收到变化通知', seen.length > 0 && seen[seen.length - 1] === 1);

  // 失败的写入也必须解除占用，否则会永久阻止关窗
  let rejectC;
  const c = new Promise((_r, rej) => { rejectC = rej; });
  const trackedC = mod.trackWrite(c);
  rejectC(new Error('boom'));
  await trackedC.catch(() => undefined);
  check('写入失败同样解除占用', mod.getPendingWriteCount() === 1);

  resolveB();
  await trackedB;
  check('全部完成后归零', mod.hasPendingWrites() === false && mod.getPendingWriteCount() === 0);

  unsubscribe();
  const before = seen.length;
  const trackedD = mod.trackWrite(Promise.resolve());
  await trackedD;
  check('退订后不再收到通知', seen.length === before);

  // trackWrite 必须透传原 promise 的结果与异常
  check('trackWrite 透传返回值', (await mod.trackWrite(Promise.resolve('ok'))) === 'ok');
  let threw = false;
  await mod.trackWrite(Promise.reject(new Error('x'))).catch(() => { threw = true; });
  check('trackWrite 透传异常', threw === true);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

// ---------- 2) db.ts 写入路径接入 ----------
const db = read('src/utils/db.ts');
check('db 引入 trackWrite', /import\s*\{[^}]*trackWrite[^}]*\}\s*from\s*'\.\/pendingWrites'/.test(db));
for (const fn of ['saveProject', 'saveProjectGroup', 'updateProjectGroupAndSystems', 'deleteProject', 'deleteProjectGroup']) {
  const body = db.split(`export async function ${fn}`)[1]?.split('\nexport ')[0] ?? '';
  check(`${fn} 计入未完成写入`, /trackWrite\(/.test(body));
}

// ---------- 3) 渲染进程 beforeunload 拦截 ----------
const guardSource = read('src/utils/pendingWrites.ts') + read('src/main.tsx');
check('注册 beforeunload 拦截', /addEventListener\('beforeunload'/.test(guardSource));
check('仅在有未完成写入时拦截', /hasPendingWrites\(\)/.test(guardSource));
check('beforeunload 阻止默认行为', /preventDefault\(\)/.test(guardSource) && /returnValue/.test(guardSource));
check('把未完成写入状态同步给桌面端主进程', /setPendingWrites/.test(guardSource));

// ---------- 4) 保存中指示 ----------
const app = read('src/App.tsx');
check('界面存在保存中指示', /正在保存/.test(app));
check('保存中指示订阅写入状态', /subscribePendingWrites|usePendingWrites/.test(app + read('src/utils/pendingWrites.ts')));

// ---------- 5) Electron 主进程拦截 ----------
const preload = read('electron/preload.cjs');
check('preload 暴露 setPendingWrites', /setPendingWrites/.test(preload));
check('preload 通过 ipc 上报', /ipcRenderer\.send\('writes:pending'/.test(preload));

const main = read('electron/main.cjs');
check('主进程监听 writes:pending', /ipcMain\.on\('writes:pending'/.test(main));
check('主进程在 close 时拦截', /win\.on\('close'/.test(main) && /event\.preventDefault\(\)/.test(main));
check('拦截时提示用户正在保存', /正在保存/.test(main));
check('提供仍然退出的逃生阀', /仍然退出/.test(main));
check('写入完成后自动关闭窗口', /forceClose|allowClose/.test(main));

// ---------- 汇总 ----------
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
if (failed > 0) {
  console.error(`\n${failed} 项未通过`);
  process.exit(1);
}
