// 校验 saveBlob / exportPreference 的关键契约与回退分支。
// 读源码断言，先归一化 CRLF。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const save = read('src/utils/saveBlob.ts');
const pref = read('src/utils/exportPreference.ts');

const checks = [
  ['saveBlob 导出', /export async function saveBlob\(/.test(save)],
  ['SaveOutcome 三态', /'saved'\s*\|\s*'downloaded'\s*\|\s*'cancelled'/.test(save)],
  ['能力检测 isSaveFilePickerSupported', /isSaveFilePickerSupported/.test(save)],
  ['调用 showSaveFilePicker', /showSaveFilePicker\(/.test(save)],
  ['写入 createWritable', /createWritable\(\)/.test(save)],
  ['返回 saved', /return 'saved'/.test(save)],
  ['取消 → cancelled', /AbortError'?\s*\)?\s*\)?\s*return 'cancelled'|=== 'AbortError'\) return 'cancelled'/.test(save)],
  ['回退普通下载 downloadViaAnchor', /downloadViaAnchor\(/.test(save)],
  ['回退返回 downloaded', /return 'downloaded'/.test(save)],
  ['picker 类型含 docx/zip/evidence', /\.docx/.test(save) && /\.zip/.test(save) && /\.evidence/.test(save)],
  // exportPreference
  ['偏好 key evidence.exportAskLocation', /evidence\.exportAskLocation/.test(pref)],
  ['getExportAskLocation 导出', /export function getExportAskLocation\(/.test(pref)],
  ['setExportAskLocation 导出', /export function setExportAskLocation\(/.test(pref)],
  ['默认随 picker 支持性', /return isSaveFilePickerSupported\(\)/.test(pref)],
  ['isSaveFilePickerSupported 导出', /export function isSaveFilePickerSupported\(/.test(pref)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
