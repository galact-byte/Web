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
import ts from 'typescript';

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
  const { planSummaryRepair, createEmptyRepairReport, claimSummaryRepairNotice } = mod;

  check('新报告包含独立的空异常详情数组', Array.isArray(createEmptyRepairReport().damagedRecords) && createEmptyRepairReport().damagedRecords.length === 0);
  const repaired = { ...createEmptyRepairReport(), repaired: 5 };
  check('首次修复结果需要提示', claimSummaryRepairNotice(repaired));
  check('返回列表再次读取同一结果不重复提示', !claimSummaryRepairNotice(repaired));
  check('提示去重不修改诊断报告', repaired.repaired === 5);
  check('尚未自检不提示', !claimSummaryRepairNotice(null));
  check('手动自检无问题不提示', !claimSummaryRepairNotice(createEmptyRepairReport()));
  check('新一轮修复即使数量相同仍提示', claimSummaryRepairNotice({ ...repaired }));
  const damaged = { ...createEmptyRepairReport(), damagedIds: ['broken'] };
  check('新发现的损坏记录仍提示', claimSummaryRepairNotice(damaged));
  check('同份损坏报告不刷屏', !claimSummaryRepairNotice(damaged));

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

// 执行实际逐条修复回调，模拟 IDB 返回值与失败事件，不访问用户数据库。
try {
  const start = syncBody.indexOf('const repairNext =');
  const end = syncBody.indexOf('\n    // 两个 getAllKeys', start);
  if (start < 0 || end < 0) throw new Error('未找到逐条修复回调');
  const callback = ts.transpileModule(syncBody.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { damagedIds: [], damagedRecords: [], repaired: 0 };
  const requests = [];
  const summaries = [];
  const projectsStore = { get: (key) => {
    const request = { key };
    requests.push(request);
    return request;
  } };
  const repairNext = new Function('projectsStore', 'summariesStore', 'summaryFromRaw', 'result',
    `${callback}\nreturn repairNext;`)(projectsStore, { put: (value) => summaries.push(value) }, (raw) => raw, result);
  const values = [null, undefined, 'PRIVATE_IMAGE_CONTENT', 0, false];
  const keys = ['null', 'undefined', 'string', 'number', 'boolean', 'failed', 'no-error', 'valid'];
  repairNext(keys, 0);
  for (const [index, value] of values.entries()) {
    requests[index].result = value;
    requests[index].onsuccess();
  }
  let prevented = 0;
  let stopped = 0;
  const event = { preventDefault: () => prevented++, stopPropagation: () => stopped++ };
  requests[5].error = new DOMException('Unable to deserialize value', 'DataError');
  requests[5].onerror(event);
  requests[6].error = null;
  requests[6].onerror(event);
  requests[7].result = { id: 'wrong-id' };
  requests[7].onsuccess();
  const details = JSON.parse(JSON.stringify(result)).damagedRecords;
  check('成功但值无效时记录类型，不包含原值', keys.slice(0, 5).every((key, i) =>
    details[i]?.projectId === key && details[i]?.reason === 'invalid-value' && details[i]?.valueType === key)
    && !JSON.stringify(result).includes('PRIVATE_IMAGE_CONTENT'));
  check('读取失败记录 DOMException 名称与信息', details[5]?.reason === 'read-error'
    && details[5]?.projectId === 'failed' && details[5]?.errorName === 'DataError'
    && details[5]?.errorMessage === 'Unable to deserialize value');
  check('缺少错误对象仍记录明确的空值', details[6]?.reason === 'read-error'
    && details[6]?.errorName === null && details[6]?.errorMessage === null);
  check('异常详情与旧 damagedIds 一一对应', JSON.stringify(result.damagedIds) === JSON.stringify(keys.slice(0, 7))
    && details.length === 7);
  check('单条失败后继续处理正常记录且不覆盖主文档', prevented === 2 && stopped === 2
    && result.repaired === 1 && summaries.length === 1 && summaries[0].id === 'valid');
} catch (error) {
  check(`逐条修复回调可运行（${error.message}）`, false);
}

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
check('诊断直接携带完整自检报告及异常详情', /const repair = getLastSummaryRepairReport\(\);/.test(errorLog) && /\n    repair,/.test(errorLog));
check('诊断包含摘要修复报告', /repair:/.test(errorLog) && /getLastSummaryRepairReport\(/.test(errorLog));
check('诊断包含项目清单便于比对缺失', /projects:\s*\[?/.test(errorLog) && /assetCount/.test(errorLog));

// ---------- 4) AppContext 契约 ----------
const appContext = read('src/context/AppContext.tsx');
check('自动保存失败会上报并提示用户（不再只写 console）', /reportCriticalError\(/.test(appContext) && !/console\.error\('Failed to save/.test(appContext));
check('读取失败时不用空模板顶替并自动保存（避免覆盖真实数据）', /loadedRef\.current = false;[\s\S]{0,400}app:loadProject/.test(appContext));
check('errorLog 提供记录+提示的关键错误通道', /export function reportCriticalError\(/.test(read('src/utils/errorLog.ts')));

const projectList = read('src/components/ProjectList.tsx');
check('列表使用跨挂载的报告去重，不用组件 ref', /claimSummaryRepairNotice\(repair\)/.test(projectList) && !/repairNoticeShownRef/.test(projectList));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
