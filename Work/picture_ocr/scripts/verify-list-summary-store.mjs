// 校验 src/utils/db.ts 的摘要 store 契约：列表只读轻量摘要、写/删/迁移同事务维护摘要；
// 升级事务只建表不遍历数据（避免坏记录抛错中止 versionchange 事务），回填改到升级后的 ensureSummariesBackfilled。
// 读源码做断言，先归一化 CRLF（Windows 工作区源码为 CRLF）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'src/utils/db.ts'), 'utf8').replace(/\r\n/g, '\n');

/** 截取某个函数体（从声明头到下一个顶层声明）。 */
function body(header) {
  const start = src.indexOf(header);
  if (start < 0) return '';
  const rest = src.slice(start + header.length);
  // 在下一个顶层声明处断开：function / async function / export function / 顶层 let|const（行首无缩进）。
  const m = rest.search(/\nexport (async )?function |\nasync function |\nfunction |\nlet |\nconst /);
  return m < 0 ? rest : rest.slice(0, m);
}

const listProjectsBody = body('export async function listProjects(');
const listGroupsBody = body('export async function listProjectGroups(');
const upgradeBody = body('function openDB(');
const backfillBody = body('export async function ensureSummariesSynced(');

const checks = [
  // v5 拆出 images store 后版本号继续递增；这里只要求不低于引入摘要 store 的 4。
  ['DB_VERSION 不低于 4', Number(/const DB_VERSION\s*=\s*(\d+)/.exec(src)?.[1] ?? 0) >= 4],
  ['定义 projectSummaries store 常量', /PROJECT_SUMMARIES_STORE_NAME\s*=\s*'projectSummaries'/.test(src)],
  ['升级新建 summaries store', /createObjectStore\(PROJECT_SUMMARIES_STORE_NAME/.test(upgradeBody)],
  ['升级事务不遍历数据（无 openCursor）', !/openCursor\(/.test(upgradeBody)],
  ['升级结构变更 try/catch 兜底并 abort', /try\s*{/.test(upgradeBody) && /\.abort\(\)/.test(upgradeBody)],
  ['升级处理 onblocked', /request\.onblocked\s*=/.test(upgradeBody)],
  // 回填从「游标遍历+跳过坏记录」改为「主键求差+逐条补建」（详见 verify-summary-repair.mjs）。
  ['自检函数逐条补建摘要', /summaryFromRaw\(/.test(backfillBody) && /projectsStore\.get\(/.test(backfillBody)],
  ['listProjects 调用自检', /ensureSummariesSynced\(\)/.test(listProjectsBody)],
  ['listProjectGroups 调用自检', /ensureSummariesSynced\(\)/.test(listGroupsBody)],
  ['summaryFromRaw 不深拷贝、仅取张数', /assetCount:\s*Array\.isArray\(raw\.assets\)\s*\?\s*raw\.assets\.length/.test(src)],

  ['listProjects 读摘要 store', /PROJECT_SUMMARIES_STORE_NAME/.test(listProjectsBody)],
  ['listProjects 不再深拷贝 assets', !/cloneAssets|normalizeProjectDocument/.test(listProjectsBody)],
  ['listProjects 不再全量读 projects store', !/PROJECTS_STORE_NAME/.test(listProjectsBody)],
  ['listProjectGroups 读摘要 store', /PROJECT_SUMMARIES_STORE_NAME/.test(listGroupsBody)],
  ['listProjectGroups 不再深拷贝 assets', !/cloneAssets|normalizeProjectDocument/.test(listGroupsBody)],
  ['listProjectGroups 不再全量读 projects store', !/PROJECTS_STORE_NAME/.test(listGroupsBody)],

  ['saveProject 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('export async function saveProject('))],
  ['createProjectGroupWithSystems 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('export async function createProjectGroupWithSystems('))],
  ['updateProjectGroupAndSystems 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('export async function updateProjectGroupAndSystems('))],
  ['deleteProject 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('export async function deleteProject('))],
  ['deleteProjectGroup 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('export async function deleteProjectGroup('))],
  ['migrateLegacyProjectIfNeeded 维护摘要', /PROJECT_SUMMARIES_STORE_NAME/.test(body('async function migrateLegacyProjectIfNeeded('))],

  ['DB 操作超时兜底常量', /DB_OP_TIMEOUT_MS\s*=/.test(src)],
  ['withTimeout 包裹', /function withTimeout<T>/.test(src) && /'openDB'/.test(src)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
