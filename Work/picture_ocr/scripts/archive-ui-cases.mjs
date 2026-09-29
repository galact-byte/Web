// 归档/提醒界面用例（由 verify-archive-ui.mjs 在隔离 Chrome 与正式 Electron 入口中驱动，页面为 dist 构建产物）。
// Web 端 showDirectoryPicker 以 OPFS 目录句柄替身（同一 FileSystemDirectoryHandle 接口）；桌面端走真实 IPC，目录框由启动脚本替换为临时目录。
import * as db from '../src/utils/db';
import JSZip from 'jszip';
import { createWordReportBlob } from '../src/utils/wordDocument';

const DAY = 24 * 60 * 60 * 1000;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
export async function until(check, label, tries = 200) {
  for (let n = 0; n < tries; n++) { if (await check()) return; await pause(50); }
  throw new Error(`等待超时：${label}；页面：${document.body.innerText.slice(-1500)}`);
}
const buttons = (root = document) => [...root.querySelectorAll('button')];
const button = (text, root = document) => buttons(root).find((el) => el.textContent.trim() === text);
const click = async (text, root = document) => {
  window.archiveUiStep = text;
  const el = button(text, root);
  assert(el && !el.disabled, `按钮不可用：${text}`);
  el.click();
  await pause(80);
};
const systemRow = (id) => document.querySelector(`[data-system-id="${id}"]`);
const archiveDialog = () => document.querySelector('[aria-labelledby="archive-dialog-title"]');
const confirmDialog = () => [...document.querySelectorAll('[role="dialog"]')].find((el) => !el.matches('[aria-labelledby="archive-dialog-title"]') && /取消|重新选择/.test(el.textContent));
const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
async function rawGet(store, key) {
  const conn = await request(indexedDB.open('evidence-collector-db'));
  try { return await request(conn.transaction(store, 'readonly').objectStore(store).get(key)); } finally { conn.close(); }
}
async function imageCount(projectId) {
  const conn = await request(indexedDB.open('evidence-collector-db'));
  try { return await request(conn.transaction('images', 'readonly').objectStore('images').index('by_project').count(projectId)); } finally { conn.close(); }
}

export async function seed() {
  const now = Date.now();
  const base = { projectCode: 'AR', projectName: '', unitName: '归档测试单位', reportDate: '2026-09-29' };
  await db.saveProjectGroup({ ...base, id: 'grp', createdAt: 1, updatedAt: now - 200 * DAY });
  const ids = [['old1', 'grp', '旧系统', 2, now - 200 * DAY], ['new1', 'grp', '新系统', 1, now - DAY], ['soloold', null, '独立旧系统', 1, now - 150 * DAY]];
  for (const [id, groupId, systemName, count, updatedAt] of ids) {
    const doc = db.createProjectDocument({ ...base, systemName }, groupId);
    doc.id = id;
    doc.createdAt = 1;
    doc.updatedAt = updatedAt;
    doc.assets = [{ id: 'asset', categoryId: doc.categories[0].id, name: '测试资产', items: [{ id: 'item', label: '截图', required: true,
      images: Array.from({ length: count }, (_, i) => ({ id: `${id}-img${i}`, fileName: `${i}.png`, data: PNG, caption: '', uploadedAt: '2026-01-01T00:00:00.000Z' })) }] }];
    await db.saveProjectWithImages(doc);
  }
  localStorage.setItem('evidence-image-migration-v5', JSON.stringify({ completedIds: ids.map((entry) => entry[0]), damagedIds: [] }));
  localStorage.removeItem('evidence-storage-reminder-v1');
  localStorage.removeItem('evidence-storage-stats-v1');
}

/** Web：以 OPFS 目录替身 showDirectoryPicker。 */
export async function installWebPicker() {
  const root = await navigator.storage.getDirectory();
  window.archiveTestDir = await root.getDirectoryHandle('archive-ui', { create: true });
  window.showDirectoryPicker = async () => window.archiveTestDir;
}

export async function reminder(platform) {
  await until(() => document.querySelector('[data-storage-reminder]'), '存储提醒条');
  const banner = document.querySelector('[data-storage-reminder]');
  assert(/2 个系统超过 90 天没有修改/.test(banner.textContent), `久未修改计数：${banner.textContent}`);
  if (platform === 'web') {
    assert(banner.dataset.storageReminder === 'urgent' && /紧急线/.test(banner.textContent), '磁盘低于紧急线应为紧急提醒');
    assert(!button('稍后提醒', banner), '紧急提醒不提供稍后提醒');
  } else {
    assert(banner.dataset.storageReminder === 'normal', '桌面仅久未修改 → 普通提醒');
    await click('稍后提醒', banner);
    await until(() => !document.querySelector('[data-storage-reminder]'), '稍后提醒后隐藏');
    const saved = JSON.parse(localStorage.getItem('evidence-storage-reminder-v1'));
    assert(saved.snoozedUntil > Date.now() + 6 * DAY, '稍后提醒写入 7 天');
  }
  return '提醒条内容与级别正确';
}

export async function afterSnoozeReload() {
  await until(() => document.querySelector('[aria-busy="false"]'), '列表加载');
  await pause(2500);
  assert(!document.querySelector('[data-storage-reminder]'), '稍后提醒期内重开不再提示');
  localStorage.removeItem('evidence-storage-reminder-v1');
  return '稍后提醒期内重开列表不再提示';
}

export async function openFromBanner() {
  await until(() => document.querySelector('[data-storage-reminder]'), '存储提醒条');
  await click('去归档', document.querySelector('[data-storage-reminder]'));
  await until(() => archiveDialog() && button('选择保存位置并归档…', archiveDialog()), '归档对话框统计完成');
  const checked = (id) => archiveDialog().querySelector(`[data-archive-system="${id}"] input`).checked;
  assert(checked('old1') && checked('soloold') && !checked('new1'), '预选久未修改的系统');
  assert(/已选 2 个系统/.test(archiveDialog().textContent), '底部已选计数');
  return '去归档打开对话框并预选候选';
}

export async function runArchive(platform) {
  await click('选择保存位置并归档…', archiveDialog());
  if (platform === 'desktop') {
    // 临时目录与隔离 userData 同在系统盘：应提示同盘，确认后继续。
    await until(() => confirmDialog() && /同一块盘/.test(confirmDialog().textContent), '同盘提示');
    await click('仍然保存到这里', confirmDialog());
  }
  await until(() => button('完成', archiveDialog()), '归档完成', 400);
  const text = archiveDialog().textContent;
  assert(/已归档 2 个系统/.test(text) && !/失败/.test(text), `归档结果：${text}`);
  return text.match(/已归档[^。]*。/)[0];
}

export async function listAfterArchive() {
  await click('完成', archiveDialog());
  await until(() => systemRow('old1')?.querySelector('[data-archived-tag]'), '列表已归档标签');
  const row = systemRow('old1');
  assert(button('恢复', row) && !button('打开', row), '已归档行显示恢复、不显示打开');
  const lan = buttons(row).find((el) => el.textContent.trim() === '手机采集');
  assert(!lan || lan.disabled, '已归档行手机采集不可用');
  assert(!systemRow('new1').querySelector('[data-archived-tag]') && button('打开', systemRow('new1')), '未归档系统不受影响');
  assert(/1 个已归档/.test(document.querySelector('[data-group-archived]').textContent), '项目组显示已归档数量');
  const doc = await rawGet('projects', 'old1');
  assert(doc.archive && (await imageCount('old1')) === 0, '库内已打标记、本地字节已删');
  return '列表标签、按钮与库内状态正确';
}

export async function bypassByUrl() {
  window.location.hash = '#/project/old1';
  await until(() => [...document.querySelectorAll('[role="status"], [role="alert"]')].some((el) => /该系统已归档/.test(el.textContent)), '经 URL 打开已归档系统的提示');
  await until(() => document.querySelector('#project-list-title'), '回到列表');
  await pause(1500);
  const doc = await rawGet('projects', 'old1');
  assert(doc.archive, '经 URL 打开后归档标记仍在（未被自动保存抹掉）');
  return '经 URL 打开已归档系统被拦回列表，标记未被覆盖';
}

export async function restore(fileBase64) {
  await until(() => document.querySelector('[aria-busy="false"]') && systemRow('old1'), '列表');
  const info = (await rawGet('projects', 'old1')).archive;
  let file;
  if (fileBase64) {
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
    file = new File([bytes], info.fileName, { type: 'application/zip' });
  } else {
    file = await (await window.archiveTestDir.getFileHandle(info.fileName)).getFile();
  }
  await click('恢复', systemRow('old1'));
  await until(() => confirmDialog() && /已归档/.test(confirmDialog().textContent), '恢复确认');
  assert(confirmDialog().textContent.includes(info.fileName), '确认框写明归档文件名');
  await click('选择归档文件恢复', confirmDialog());
  const input = document.querySelector('[data-restore-input]');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await until(async () => !(await rawGet('projects', 'old1')).archive, '恢复完成');
  await until(() => button('打开', systemRow('old1')) && !systemRow('old1').querySelector('[data-archived-tag]'), '列表恢复为可打开');
  assert((await imageCount('old1')) === 2, '图片回到本地');
  // 与工作台「导出 Word」同一条路径：hydrateAssets 取回字节 → createWordReportBlob；报告内嵌的必须是原图字节。
  const doc = await db.loadProject('old1');
  const blob = await createWordReportBlob(doc.meta, doc.categories, await db.hydrateAssets('old1', doc.assets));
  const zip = await JSZip.loadAsync(blob);
  const original = PNG.slice(PNG.indexOf(',') + 1);
  const mediaNames = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith('word/media/')).map((entry) => entry.name);
  const originalMedia = [];
  for (const name of mediaNames) if ((await zip.file(name).async('base64')) === original) originalMedia.push(name.slice('word/'.length));
  assert(originalMedia.length > 0, `Word 报告内嵌原图字节（媒体 ${mediaNames.length} 个）`);
  // docx 对相同字节只存一份媒体文件：按关系表找到原图的 rId，再数正文里引用了几次。
  const rels = await zip.file('word/_rels/document.xml.rels').async('string');
  const ids = [...rels.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].filter((m) => originalMedia.includes(m[2])).map((m) => m[1]);
  const body = await zip.file('word/document.xml').async('string');
  const refs = ids.reduce((sum, id) => sum + body.split(`r:embed="${id}"`).length - 1, 0);
  assert(refs === 2, `Word 报告正文引用两张原图（实际 ${refs}，rId ${ids.join('/')}）`);
  return '选择归档文件恢复，列表与本地图片复原，Word 报告内嵌原图字节';
}

export async function settings(platform) {
  await click('存储设置');
  await until(() => document.querySelector('[data-disk-free]') && !/读取中/.test(document.querySelector('[data-disk-free]').textContent), '磁盘剩余');
  const disk = document.querySelector('[data-disk-free]').textContent;
  assert(/剩余 .* \/ 共 /.test(disk), `磁盘剩余显示：${disk}`);
  if (platform === 'web') {
    await until(() => document.querySelector('[data-persistence]')?.dataset.persistence !== 'loading', '持久存储状态');
    assert(/持久存储/.test(document.querySelector('[data-persistence]').textContent), '显示持久存储状态');
  } else {
    assert(!document.querySelector('[data-persistence]'), '桌面不显示持久存储');
  }
  const staleInput = document.getElementById('reminder-stale');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(staleInput, '365');
  staleInput.dispatchEvent(new Event('input', { bubbles: true }));
  await pause(50);
  await click('保存提醒设置');
  assert(JSON.parse(localStorage.getItem('evidence-storage-reminder-v1')).staleDays === 365, '阈值保存');
  return `存储设置：${disk.trim()}，阈值保存`;
}

export async function settingsOpenArchive() {
  await click('查看占用明细与归档…');
  await until(() => archiveDialog() && button('选择保存位置并归档…', archiveDialog()), '从设置打开归档');
  const soloRow = archiveDialog().querySelector('[data-archive-system="soloold"]');
  assert(/已归档/.test(soloRow.textContent) && soloRow.querySelector('input').disabled, '已归档系统在明细里不可再选');
  return '从存储设置打开归档，已归档系统不可再选';
}

export async function closeArchive() {
  await click('取消', archiveDialog());
  await until(() => !archiveDialog(), '关闭归档对话框');
  return '关闭';
}

export async function unsupportedWeb() {
  delete window.showDirectoryPicker;
  await click('存储设置');
  await click('查看占用明细与归档…');
  await until(() => archiveDialog() && button('选择保存位置并归档…', archiveDialog()), '对话框');
  assert(/不支持选择保存目录/.test(archiveDialog().textContent), '不支持时说明原因');
  assert(button('选择保存位置并归档…', archiveDialog()).disabled, '不支持时不可归档');
  await click('取消', archiveDialog());
  return '浏览器不支持目录选择时禁止归档并说明';
}
