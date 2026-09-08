// 校验客户端报错采集：errorLog 模块 API、全局 handler 安装、db 超时接入、诊断导出走 <a download>。
// 读源码做断言，先归一化 CRLF（Windows 工作区源码为 CRLF）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

const errorLog = read('src/utils/errorLog.ts');
const main = read('src/main.tsx');
const app = read('src/App.tsx');
const db = read('src/utils/db.ts');
const settings = read('src/components/StorageSettingsDialog.tsx');

const checks = [
  ['errorLog 导出 recordError', /export function recordError\(/.test(errorLog)],
  ['errorLog 导出 getErrorLog', /export function getErrorLog\(/.test(errorLog)],
  ['errorLog 导出 clearErrorLog', /export function clearErrorLog\(/.test(errorLog)],
  ['errorLog 导出 installGlobalErrorHandlers', /export function installGlobalErrorHandlers\(/.test(errorLog)],
  ['errorLog 导出 setErrorNotifier', /export function setErrorNotifier\(/.test(errorLog)],
  ['errorLog 导出 buildDiagnosticsReport', /export async function buildDiagnosticsReport\(/.test(errorLog)],
  ['errorLog 导出 downloadDiagnostics', /export async function downloadDiagnostics\(/.test(errorLog)],
  ['localStorage 环形缓冲键', /evidence-error-log/.test(errorLog)],
  ['环形缓冲有上限截断', /slice\(0,\s*MAX_ENTRIES\)/.test(errorLog)],
  ['捕获 window error', /addEventListener\('error'/.test(errorLog)],
  ['捕获 unhandledrejection', /addEventListener\('unhandledrejection'/.test(errorLog)],
  ['诊断包含版本/环境/计数/错误', /app:\s*appVersion\(\)/.test(errorLog) && /userAgent:/.test(errorLog) && /counts/.test(errorLog) && /errors:\s*getErrorLog\(\)/.test(errorLog)],
  ['导出走 <a download>', /createElement\('a'\)/.test(errorLog) && /\.download\s*=/.test(errorLog)],
  ['导出不使用 showSaveFilePicker', !/showSaveFilePicker/.test(errorLog)],

  ['main.tsx 安装全局 handler', /installGlobalErrorHandlers\(\)/.test(main)],
  ['App.tsx 接线 setErrorNotifier', /setErrorNotifier\(/.test(app)],

  ['db.ts 引入 recordError', /import \{ recordError \} from '\.\/errorLog'/.test(db)],
  ['db.ts 超时/失败记入日志', /recordError\(\{\s*type:\s*'manual'/.test(db)],

  ['存储设置有导出诊断入口', /downloadDiagnostics/.test(settings) && /导出诊断包/.test(settings)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
