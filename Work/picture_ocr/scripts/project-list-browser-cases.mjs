import * as db from '../src/utils/db';
import JSZip from 'jszip';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(check, label) {
  for (let n = 0; n < 100; n++) { if (await check()) return; await pause(50); }
  throw new Error(`等待超时：${label}；页面：${document.body.innerText.slice(-1800)}`);
}
const assert = (value, label) => { if (!value) throw new Error(label); };
const rows = () => [...document.querySelectorAll('[data-system-id]')];
const groups = () => [...document.querySelectorAll('[data-group-id]')];
const button = (text, root = document) => [...root.querySelectorAll('button')].find(el => el.textContent.trim() === text);
const click = async (text, root = document) => { window.projectListTestStep = text; const el = button(text, root); assert(el && !el.disabled, `按钮不可用：${text}`); el.click(); await pause(80); };
const tab = async kind => { document.querySelectorAll('nav[aria-label="项目分类"] button')[kind === 'groups' ? 0 : 1].click(); await pause(100); };
const systemRow = id => document.querySelector(`[data-system-id="${id}"]`);
const groupRow = id => document.querySelector(`[data-group-id="${id}"]`);
const groupToggle = id => document.getElementById(`group-toggle-${id}`);
async function expand(id) { const toggle = groupToggle(id); assert(toggle, `项目展开入口：${id}`); if (toggle.getAttribute('aria-expanded') !== 'true') { toggle.click(); await pause(80); } }
const dialog = () => document.querySelector('[role="dialog"]');
function input(el, value) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }
async function search(value) { input(document.querySelector('input[type="search"]'), value); await pause(80); }
async function menu(id, text) { const root = systemRow(id); root.querySelector('summary').click(); await pause(80); await click(text, root); }
async function back() { await click('返回项目列表'); await until(() => !!document.querySelector('#project-list-title'), '返回列表'); await until(() => document.querySelector('[aria-busy="false"]'), '摘要加载'); }
const onePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';

export async function seed() {
  const base = { projectCode: 'QA', projectName: '', unitName: '测试单位', reportDate: '2026-09-14', createdAt: 1, updatedAt: 1 };
  for (const [id, projectName] of [['multi', '公共资源中心公共服务与产权交易综合管理项目'], ['single', '只有一个系统的项目'], ['empty', '空项目']]) await db.saveProjectGroup({ ...base, id, projectName });
  const records = [['g1', 'multi', '公共资源交易与产权服务综合交易平台'], ['g2', 'multi', '公共资源中心跨部门协同办公系统'], ['s1', 'single', '采购系统'], ['orphan', 'missing', '档案系统'],
    ...Array.from({ length: 24 }, (_, i) => [`solo${i}`, null, `独立系统${String(i).padStart(2, '0')}——用于检查窄屏下很长的中文系统名称仍然完整可读`])];
  for (const [id, groupId, systemName] of records) {
    const doc = db.createProjectDocument({ ...base, systemName }, groupId);
    doc.id = id; doc.createdAt = 1;
    if (id === 'g1') doc.meta.unitName = '公共资源交易运营分中心';
    doc.updatedAt = 1000 - records.findIndex(record => record[0] === id);
    doc.assets = [{ id: 'asset', categoryId: doc.categories[0].id, name: '测试资产', items: [{ id: 'item', label: '截图', required: true, images: [] }] }];
    await db.saveProject(doc);
  }
  localStorage.setItem('evidence-image-migration-v5', JSON.stringify({ completed: records.map(record => record[0]), damaged: [] }));
}

export function instrument() {
  const reads = { documents: 0, images: 0 };
  for (const method of ['get', 'getAll', 'openCursor']) {
    const original = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function (...args) {
      if (this.name === 'projects') reads.documents++;
      if (this.name === 'images') reads.images++;
      return original.apply(this, args);
    };
  }
  return reads;
}

export async function core() {
  await until(() => groups().length === 4, '项目分类');
  assert(rows().length === 4 && !systemRow('solo0'), '初次全部展开，仅包含有归属系统');
  assert(!button('进入项目') && !button('返回项目管理'), '不再需要详情页导航');
  const nav = document.querySelector('nav').textContent;
  assert(nav.includes('3') && nav.includes('24') && nav.includes('1 个异常组'), '真实组、独立系统和异常组计数');
  for (const group of groups()) { groupToggle(group.dataset.groupId).click(); await pause(30); }
  assert(rows().length === 0, '允许全部收起');
  window.location.hash = '/project/solo7'; await until(() => !!button('返回项目列表'), '收起后工作区'); await back();
  assert(rows().length === 0, '全部收起在重新加载列表后不自动展开');
  await search('交易平台'); assert(groups().length === 1 && rows().length === 1 && systemRow('g1'), '系统搜索自动展开且只显示匹配系统');
  await search('公共资源'); assert(rows().length === 2, '项目名称命中显示全组');
  await search(''); assert(rows().length === 0, '清除搜索恢复全部收起');
  await expand('multi'); await expand('single');
  assert(rows().length === 3, '允许多个项目同时展开');
  systemRow('g1').querySelector('input').click(); await pause(60);
  systemRow('s1').querySelector('input').click(); await pause(60);
  assert(!systemRow('g1').querySelector('input').checked && systemRow('s1').querySelector('input').checked, '切组选择清空前组');
  groupToggle('single').click(); await pause(60); await expand('single');
  assert(!systemRow('s1').querySelector('input').checked, '收起清除组内选择');
  await search('办公'); assert(rows().length === 1 && !button('删除选中', groupRow('multi')), '搜索清空选择');
  groupRow('multi').querySelector('[aria-label="全选当前可见系统"]').click(); await pause(60);
  await click('删除选中', groupRow('multi')); assert(dialog().textContent.includes('办公系统') && !dialog().textContent.includes('交易平台'), '确认框仅含当前组可见选择'); await click('取消', dialog());
  await click('打开', systemRow('g2')); await until(() => !!button('返回项目列表'), '工作区'); await back();
  assert(rows().length === 1 && !!systemRow('g2') && !button('删除选中', groupRow('multi')), '工作区返回保留搜索展开、不恢复选择');
  await search(''); assert(rows().length === 3, '返回后清除搜索恢复原展开');
  await expand('empty'); assert(groupRow('empty').textContent.includes('此项目暂无系统'), '空组展开');
  await expand('missing'); assert(systemRow('orphan') && !button('添加系统', groupRow('missing')), '异常组保留入口且不能改组记录');
  window.scrollTo(0, 450); await pause(60); const groupY = window.scrollY;
  await click('打开', systemRow('orphan')); await until(() => !!button('返回项目列表'), '异常组可打开'); await back(); await pause(80);
  assert(Math.abs(window.scrollY - groupY) < 3, '项目页展开后返回恢复滚动');
  await tab('independent'); await until(() => rows().length === 24, '独立列表');
  window.scrollTo(0, 850); await pause(100); const savedY = window.scrollY;
  await click('打开', systemRow('solo7')); await until(() => !!button('返回项目列表'), '独立工作区'); await back(); await pause(150);
  assert(Math.abs(window.scrollY - savedY) < 3, `独立列表滚动恢复：${savedY} -> ${window.scrollY}`);
  systemRow('solo0').querySelector('input').click(); await pause(50); await tab('groups'); await tab('independent');
  assert(button('删除选中').disabled, '切页清空选择');
  window.scrollTo(0, 0);
  return '原地多组展开、全部收起、搜索恢复、单组选择与双页签返回滚动';
}

export async function mutations() {
  await tab('independent'); await search('不存在');
  await click('新建项目'); await click('取消', dialog()); assert(document.querySelector('input[type="search"]').value === '不存在', '取消创建不跳转');
  await click('新建项目');
  let inputs = dialog().querySelectorAll('input'); input(inputs[2], '新增单位'); input(inputs[4], '新增独立系统');
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) { if (mode === 'readwrite') throw new Error('受控保存失败'); return transaction.call(this, names, mode, ...args); };
  try { await click('保存', dialog()); await until(() => document.body.textContent.includes('受控保存失败'), '保存失败反馈'); assert(!!dialog() && document.querySelector('input[type="search"]').value === '不存在', '保存失败不跳转'); }
  finally { IDBDatabase.prototype.transaction = transaction; }
  await click('保存', dialog()); await until(() => !dialog(), '保存单系统');
  await until(() => rows().some(row => row.textContent.includes('新增独立系统')), '创建后清空过滤并定位独立列表');
  await click('新建项目'); inputs = dialog().querySelectorAll('input'); input(inputs[1], '新增多系统项目'); input(inputs[2], '新增单位'); input(inputs[4], '新增甲系统、新增乙系统');
  await click('保存', dialog()); await until(() => !dialog(), '保存多系统');
  await until(() => groups().some(group => group.textContent.includes('新增多系统项目')), '新建多系统定位项目页');
  const createdId = groups().find(group => group.textContent.includes('新增多系统项目')).dataset.groupId;
  const createdRows = () => [...groupRow(createdId).querySelectorAll('[data-system-id]')];
  await until(() => createdRows().length === 2 && groupToggle(createdId).getAttribute('aria-expanded') === 'true', '新项目自动展开');
  assert(document.activeElement.closest('[data-system-id]'), '新建定位到系统');
  await search('新增甲'); await click('添加系统', groupRow(createdId)); input(dialog().querySelector('input'), '新增丙系统'); await click('保存', dialog());
  await until(() => !dialog() && createdRows().length === 3, '添加系统清空过滤');
  const originalIds = createdRows().map(row => row.dataset.systemId);
  await menu(originalIds[0], '编辑'); input(dialog().querySelector('input'), '修改后的系统名称'); await click('保存', dialog());
  await until(() => !dialog() && systemRow(originalIds[0]).textContent.includes('修改后的系统名称'), '编辑目标');
  await menu(originalIds[0], '压缩图片'); assert(dialog().textContent.includes('修改后的系统名称'), '压缩确认目标'); await click('取消', dialog());
  await menu(originalIds[0], '压缩图片'); await click('开始压缩', dialog()); await until(() => !dialog() && document.body.textContent.includes('已足够小'), '空图片压缩完成提示');
  await menu(originalIds[0], '导入数据包'); assert(dialog().textContent.includes('修改后的系统名称'), '导入目标'); await click('取消', dialog());
  await menu(originalIds[0], '删除'); await click('删除系统', dialog()); await until(() => !systemRow(originalIds[0]), '删除指定系统');
  assert(createdRows().length === 2 && groupToggle(createdId).getAttribute('aria-expanded') === 'true', '删除后原组保持展开');
  groupRow(createdId).querySelector('[aria-label="全选当前可见系统"]').click(); await pause(80);
  await click('删除选中', groupRow(createdId)); await click('删除系统', dialog()); await until(() => createdRows().length === 0, '批量删除组内最后系统');
  assert(groupRow(createdId).textContent.includes('此项目暂无系统'), '删除最后系统后保留空组');
  const details = groupRow(createdId).querySelector('summary[aria-label$="的项目操作"]'); details.click(); await pause(80);
  await click('删除项目组', details.parentElement); await click('删除项目组', dialog());
  await until(() => !groupRow(createdId), '删除项目后仍在原列表');
  assert(await db.loadProject('orphan'), '所有操作不改变异常组系统');
  return '单/多系统新建定位、添加、编辑、压缩确认和完成、导入目标、删除系统与当前组';
}

export async function exportAndImport() {
  await tab('groups'); await search(''); await expand('missing');
  const objectUrls = new Map();
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = value => { const url = createObjectURL(value); objectUrls.set(url, value); return url; };
  const downloads = [];
  const original = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push({ name: this.download, promise: Promise.resolve(objectUrls.get(this.href)) }); else original.call(this); };
  try {
    await menu('orphan', '导出数据包'); await until(() => downloads.length === 1, '异常组导出');
    const exported = await JSZip.loadAsync(await downloads[0].promise);
    assert(Object.keys(exported.files).length > 0, '导出有效 ZIP');
  } finally { HTMLAnchorElement.prototype.click = original; }
  await tab('independent');
  const source = await db.loadProject('g1');
  source.assets[0].items[0].images = [{ id: 'tiny', fileName: 'tiny.png', mimeType: 'image/png', data: onePixel, createdAt: 1 }];
  await db.saveProject(source);
  // 用生产导出生成导入夹具，断言目标归属不被来源覆盖。
  let blob;
  HTMLAnchorElement.prototype.click = function () { blob = Promise.resolve(objectUrls.get(this.href)); };
  try { await tab('groups'); await search(''); await expand('multi'); await menu('g1', '导出数据包'); await until(() => !!blob, '导入夹具导出'); }
  finally { HTMLAnchorElement.prototype.click = original; }
  const file = new File([await blob], 'fixture.zip', { type: 'application/zip' });
  await tab('independent');
  for (const mode of ['合并导入', '覆盖导入']) {
    await menu('solo0', '导入数据包');
    const transfer = new DataTransfer(); transfer.items.add(file);
    const fileInput = dialog().querySelector('input[type="file"]'); fileInput.files = transfer.files; fileInput.dispatchEvent(new Event('change', { bubbles: true })); await pause(80);
    const action = [...dialog().querySelectorAll('button')].find(el => el.textContent.includes(mode)); assert(action, mode); action.click();
    await until(() => !!button('完成', dialog()), mode); await click('完成', dialog());
    const target = await db.loadProject('solo0');
    assert(target.groupId === null && target.assets[0].items[0].images.length === 1, `${mode}只写目标且保留归属`);
  }
  URL.createObjectURL = createObjectURL;
  return '异常组真实 ZIP 导出、合并/覆盖导入及图片与归属检查';
}

export async function failedLoad() {
  await tab('groups'); await search(''); await expand('single'); await click('打开', systemRow('s1'));
  await until(() => !!button('返回项目列表'), '工作区');
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, ...args) {
    if ((Array.isArray(names) ? names : [names]).includes('projectGroups') && (!args[0] || args[0] === 'readonly')) throw new Error('受控摘要加载失败');
    return transaction.call(this, names, ...args);
  };
  try { await click('返回项目列表'); await until(() => !!document.querySelector('[role="alert"]'), '加载失败反馈');
    assert(!document.body.textContent.includes('此项目暂无系统'), '加载失败不伪装空项目');
  } finally { IDBDatabase.prototype.transaction = transaction; }
  await click('重试'); await until(() => !!systemRow('s1'), '失败重试保留原组');
  // 另一个系统工作区期间删除原组，避免当前系统退出时的既有 flushSave 重建测试记录。
  window.location.hash = '/project/solo1'; await until(() => !!button('返回项目列表'), '外部删除前工作区');
  await db.deleteProjectGroup('single'); await back(); await until(() => !groupRow('single') && document.querySelector('#project-list-title').textContent === '多系统项目', '外部删除后原组消失且列表可用');
  return '受控加载失败提示/重试、外部删除后导航修复';
}

export async function savedButRefreshFailed() {
  await tab('groups'); await search('公共资源');
  const wasExpanded = groupToggle('multi').getAttribute('aria-expanded');
  await click('新建项目'); const inputs = dialog().querySelectorAll('input');
  input(inputs[2], '新增单位'); input(inputs[4], '刷新失败仍保存的系统');
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) {
    if ((Array.isArray(names) ? names : [names]).includes('projectGroups') && (!mode || mode === 'readonly')) throw new Error('新增后的列表刷新失败');
    return transaction.call(this, names, mode, ...args);
  };
  try {
    await click('保存', dialog()); await until(() => !dialog() && document.body.textContent.includes('新增后的列表刷新失败'), '已保存但刷新失败');
    assert(document.querySelector('input[type="search"]').value === '公共资源' && groupToggle('multi').getAttribute('aria-expanded') === wasExpanded, '刷新失败保留浏览状态');
    assert(document.querySelector('nav button[aria-current="page"]').textContent.includes('多系统项目'), '刷新失败不提前跳页');
    const saved = await db.listProjects();
    assert(saved.filter(system => system.meta.systemName === '刷新失败仍保存的系统').length === 1, '保存成功且仅创建一次');
  } finally { IDBDatabase.prototype.transaction = transaction; }
  await click('重试');
  await until(() => rows().some(row => row.textContent.includes('刷新失败仍保存的系统')), '重试后定位已创建系统');
  assert(document.activeElement.closest('[data-system-id]')?.textContent.includes('刷新失败仍保存的系统'), '重试后聚焦新增系统');
  return '新增保存成功但刷新失败保留原位置，重试成功后定位且不重复创建';
}

export async function groupLayout() {
  await tab('groups'); await search(''); await expand('multi'); await expand('missing'); window.scrollTo(0, 0); await pause(100);
  assert(document.documentElement.scrollWidth <= innerWidth, `项目展开横向溢出：${innerWidth}`);
  for (const row of rows()) assert(row.closest('[data-group-id]'), '系统保留所属项目容器');
  assert(document.querySelector('#project-list-title').getBoundingClientRect().height <= 1, '无重复可见分类标题');
  assert(!button('进入项目') && !button('返回项目管理'), '没有多余详情导航');
  assert(systemRow('g1').textContent.includes('公共资源交易运营分中心'), '子系统单位与项目不同时仍可见');
  assert(!systemRow('g2').textContent.includes('测试单位'), '相同单位集中在项目栏，系统不重复');
  const toggle = groupToggle('multi');
  const icon = toggle.querySelector('svg');
  assert(icon && icon.getBoundingClientRect().width >= 20, '展开图标清晰可见，至少 20px');
  assert(icon.parentElement.getBoundingClientRect().width >= 44 && toggle.getBoundingClientRect().height >= 44, '展开入口至少 44px，标题可点击');
  assert(!groupRow('multi').textContent.includes('组内系统 ·'), '不再用重复计数工具栏占据一行');
  assert(!button('删除选中', groupRow('multi')), '未选择时不展示批量删除');
  const header = groupRow('multi').querySelector('[data-system-header]');
  assert(header.textContent.includes('系统名称') && header.textContent.includes('资产数'), '组内有自己的系统表头');
  if (innerWidth >= 1024) {
    for (const column of ['updated', 'assets']) {
      const heading = header.querySelector(`[data-column="${column}"]`).getBoundingClientRect();
      const cell = systemRow('g1').querySelector(`[data-column="${column}"]`).getBoundingClientRect();
      assert(Math.abs(heading.left - cell.left) < 1 && Math.abs(heading.width - cell.width) < 1, `${column} 表头和内容对齐`);
    }
  }
  systemRow('g1').querySelector('input').click(); await pause(60);
  assert(button('删除选中', groupRow('multi')), '选择后批量操作可达');
  assert(document.documentElement.scrollWidth <= innerWidth, '选中工具不造成溢出');
  systemRow('g1').querySelector('input').click(); await pause(60);
  const more = groupRow('multi').querySelector('summary'); more.click(); await pause(80);
  const rect = more.nextElementSibling.getBoundingClientRect();
  assert(rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, '项目菜单位于窗口内');
  more.click(); await pause(60);
  return '项目与系统原地层级、无重复标题、项目菜单和列表无溢出';
}

export async function prepareDefault(kind) {
  const summaries = await db.listProjectGroups();
  for (const summary of summaries) {
    if (summary.group) await db.deleteProjectGroup(summary.id);
    else for (const system of summary.systems) await db.deleteProject(system.id);
  }
  if (kind === 'independent') await db.saveProject(db.createProjectDocument({ systemName: '默认独立系统', unitName: '测试单位' }));
}

export async function layout() {
  for (const close of document.querySelectorAll('[aria-label="关闭提示"]')) close.click();
  await tab('independent'); await search(''); window.scrollTo(0, 0); await pause(100);
  assert(document.documentElement.scrollWidth <= innerWidth, `列表横向溢出：${document.documentElement.scrollWidth}/${innerWidth}`);
  const row = rows()[0]; const summary = row.querySelector('summary'); summary.click(); await pause(100);
  const rect = summary.nextElementSibling.getBoundingClientRect();
  assert(rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, '菜单保持在窗口内');
  document.querySelector('h2').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  assert(!summary.parentElement.open, '外部点击关闭菜单');
  summary.click(); await pause(60);
  const other = rows()[1].querySelector('summary'); other.click(); await pause(60);
  assert(document.querySelectorAll('details[open]').length === 1, '同一时刻只展开一个菜单');
  other.click(); await pause(60);
  const last = rows().at(-1).querySelector('summary'); last.scrollIntoView({ block: 'end' }); await pause(80); last.click(); await pause(80);
  const lastRect = last.nextElementSibling.getBoundingClientRect();
  assert(lastRect.top >= 0 && lastRect.bottom <= innerHeight && lastRect.bottom <= last.getBoundingClientRect().top, '底部菜单向上展开');
  last.click(); window.scrollTo(0, 0); await pause(100);
  return '列表与菜单无溢出、外部点击关闭、单菜单与底部向上展开';
}

export async function startLan(scope) {
  await until(() => document.querySelector('[aria-busy="false"]'), '采集前列表加载');
  await tab('groups'); await search('交易平台');
  if (scope === 'workbench') {
    await click('打开', systemRow('g1'));
    await until(() => !!button('项目信息'), '工作台启动');
    await until(() => !!button('手机局域网采集'), '工作台采集入口');
    await click('手机局域网采集');
  } else if (scope === 'group') await click('手机采集', groupRow('multi'));
  else { await expand('multi'); await click('手机采集', systemRow('g1')); }
  await until(() => !!button('启动局域网采集'), '采集对话框');
  // 等待 App 的异步组快照组装完成，再提交真实会话启动。
  await pause(500); await click('启动局域网采集');
  await until(() => !!button('停止会话'), '采集启动');
  const text = document.querySelector('[aria-labelledby="lan-collector-title"]').textContent;
  return text.match(/https?:\/\/[^\s]+\/#\/lan\/[A-Za-z0-9_-]+/)?.[0];
}
export async function stopLan() {
  await click('停止会话'); await until(() => !!button('启动局域网采集'), '采集停止');
  document.querySelector('[aria-label="收起手机局域网采集对话框"]').click(); await pause(80);
}
export async function verifyLanImage() {
  const doc = await db.loadProject('g2');
  assert(doc.assets[0].items[0].images.length === 1, '上传写入 g2');
  const snapshot = await import('../src/utils/lanGroupSnapshot');
  const data = await snapshot.buildGroupSnapshot({ groupId: 'multi', groupTitle: '公共资源中心', systemIds: ['g1', 'g2'], openSystemOverride: null });
  assert(data.systems.find(system => system.projectId === 'g2').assets[0].items[0].imageCount === 1, '采集计数同步');
}

export { tab, search, click, button, systemRow, groupRow, pause };
