// 校验 src/utils/storageEstimate.ts 的关键契约与降级分支存在。
// 读源码做断言，先归一化 CRLF（Windows 工作区源码为 CRLF）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'src/utils/storageEstimate.ts'), 'utf8').replace(/\r\n/g, '\n');

const checks = [
  ['导出 getStorageEstimate', /export async function getStorageEstimate\(\)/.test(src)],
  ['导出 formatBytes', /export function formatBytes\(/.test(src)],
  ['导出 STORAGE_WARN_RATIO', /export const STORAGE_WARN_RATIO\s*=/.test(src)],
  ['能力检测 navigator.storage.estimate', /navigator\.storage\.estimate/.test(src)],
  ['不支持时降级 supported:false', /supported:\s*false/.test(src)],
  ['try/catch 兜底', /try\s*\{[\s\S]*catch\b/.test(src)],
  ['计算 ratio = usage/quota', /usage\s*\/\s*quota/.test(src)],
  ['formatBytes 处理无效值返回未知', /return '未知'/.test(src)],
  ['formatBytes 覆盖 GB 级单位', /'GB'/.test(src)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
