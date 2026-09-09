// 校验「摘要自检修复」链路：
// 1) 纯逻辑 planSummaryRepair（主键求差）用真实调用测试，编译 src/utils/summaryRepair.ts 后 import；
// 2) db.ts 契约：按主键求差补建摘要、id 用记录主键兜底、清理孤立摘要、损坏记录不中止事务且可上报；
// 3) errorLog.ts 契约：诊断包含 stores 真实条数、修复报告与项目清单；
// 4) AppContext 契约：保存失败必须上报（不再只 console.error）。
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
const outDir = mkdtempSync(path.join(tmpdir(), 'summary-repair-'));
try {
  // 直接用本地 typescript 的入口脚本（Windows 下 execFileSync 调 npx.cmd 会 EINVAL）。
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/typescript/bin/tsc'),
      'src/utils/summaryRepair.ts',
      '--outDir', outDir,
      '--module', 'esnext',
      '--target', 'es2020',
      '--strict',
      '--skipLibCheck',
      // 默认会自动引入 node_modules/@types/*（babel/node 等）并报缺失依赖，指向不存在的 typeRoots 避开。
      '--typeRoots', './no-such-types',
    ],
    { cwd: root, stdio: 'pipe' }
  );
  const mod = await import(pathToFileURL(path.join(outDir, 'summaryRepair.js')).href);
  const { planSummaryRepair } = mod;

  const plan1 = planSummaryRepair(['a', 'b', 'c'], ['a']);
  check('缺摘要的项目被全部检出', JSON.stringify(plan1.missing) === JSON.stringify(['b', 'c']));
  check('无孤立摘要时 orphans 为空', plan1.orphans.length === 0);

  const plan2 = planSummaryRepair(['a'], ['a', 'ghost']);
  check('有摘要无项目的孤立记录被检出', JSON.stringify(plan2.orphans) === JSON.stringify(['ghost']));
  check('孤立场景不误报缺失', plan2.missing.length === 0);

  const plan3 = planSummaryRepair(['a', 'b'], ['b', 'a']);
  check('顺序不同但一致时无需修复', plan3.missing.length === 0 && plan3.orphans.length === 0);

  const plan4 = planSummaryRepair([], []);
  check('空库不产生修复动作', plan4.missing.length === 0 && plan4.orphans.length === 0);

  const plan5 = planSummaryRepair([1, 'b'], ['1']);
  check('主键类型不一致时按字符串比对', plan5.missing.length === 1 && String(plan5.missing[0]) === 'b');
} catch (err) {
  check(`planSummaryRepair 可编译并按预期工作（${err.message.split('\n')[0]}）`, false);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

// ---------- 2) db.ts 契约 ----------
const db = read('src/utils/db.ts');
const dbBody = (header) => {
  const start = db.indexOf(header);
  if (start < 0) return '';
  const rest = db.slice(start + header.length);
  const m = rest.search(/\nexport (async )?function |\nasync function |\nfunction |\nlet |\nconst /);
  return m < 0 ? rest : rest.slice(0, m);
};
const syncBody = dbBody('async function ensureSummariesSynced(');

check('存在摘要自检函数 ensureSummariesSynced', syncBody.length > 0);
check('自检按主键集合求差（getAllKeys）', /getAllKeys\(\)/.test(syncBody) && /planSummaryRepair\(/.test(syncBody));
check('不再用计数近似判断是否已回填', !/summariesTotal\s*>=\s*projectsTotal/.test(db));
check('补建摘要时 id 以记录主键兜底', /id:\s*String\(key\)/.test(syncBody));
check('清理孤立摘要', /summariesStore\.delete\(/.test(syncBody));
check('读不出的记录计入损坏清单', /damagedIds/.test(syncBody));
check('单条读失败不中止整个事务', /preventDefault\(\)/.test(syncBody));
check('缺失记录逐条读取（不整表 getAll）', !/projectsStore\.getAll\(\)/.test(syncBody) && /projectsStore\.get\(/.test(syncBody));
check('修复报告可供 UI/诊断读取', /export function getLastSummaryRepairReport\(/.test(db));
check('支持强制重新自检', /ensureSummariesSynced\(true\)|force/.test(db));
check('listProjects 调用自检', /ensureSummariesSynced\(/.test(dbBody('export async function listProjects(')));
check('listProjectGroups 调用自检', /ensureSummariesSynced\(/.test(dbBody('export async function listProjectGroups(')));
check('导出各 store 真实条数诊断', /export async function getStoreDiagnostics\(/.test(db));
check('诊断能识别遗留 legacy 记录未迁移', /legacyStranded/.test(db));
check(
  '整份文档读写使用更宽松的超时，避免大文档误判失败',
  /DB_DOC_TIMEOUT_MS\s*=/.test(db) && /'saveProject',\s*DB_DOC_TIMEOUT_MS/.test(db) && /'loadProject',\s*DB_DOC_TIMEOUT_MS/.test(db)
);

// ---------- 3) errorLog.ts 契约 ----------
const errorLog = read('src/utils/errorLog.ts');
check('诊断包含各 store 真实条数', /stores:/.test(errorLog) && /getStoreDiagnostics\(/.test(errorLog));
check('诊断包含摘要修复报告', /repair:/.test(errorLog) && /getLastSummaryRepairReport\(/.test(errorLog));
check('诊断包含项目清单便于比对缺失', /projects:\s*\[?/.test(errorLog) && /assetCount/.test(errorLog));

// ---------- 4) AppContext 契约 ----------
const appContext = read('src/context/AppContext.tsx');
check('自动保存失败会上报并提示用户（不再只写 console）', /reportCriticalError\(/.test(appContext) && !/console\.error\('Failed to save/.test(appContext));
check('读取失败时不用空模板顶替并自动保存（避免覆盖真实数据）', /loadedRef\.current = false;[\s\S]{0,400}app:loadProject/.test(appContext));
check('errorLog 提供记录+提示的关键错误通道', /export function reportCriticalError\(/.test(read('src/utils/errorLog.ts')));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
