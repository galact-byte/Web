// 存储提醒 / 持久存储 / 磁盘剩余读取用例（由 verify-storage-reminder.mjs 在隔离 Chrome/Electron 中执行）。
// 持久存储与磁盘剩余的浏览器 API、桌面桥、本机服务在此处以 mock 注入（真实环境行为见 research/quota.md 与 P7 人工验收）。
import * as reminder from '../src/utils/storageReminder';
import * as persistence from '../src/utils/storagePersistence';

const DAY = 24 * 60 * 60 * 1000;
const GB = 1024 * 1024 * 1024;
const NOW = Date.UTC(2026, 8, 29);

export async function run() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok: !!ok }); };
  const test = async (name, fn) => {
    try { await fn(); } catch (error) { check(`${name}: ${error && error.stack || error}`, false); }
  };
  localStorage.clear();

  await test('设置：默认值、校验、往返、稍后提醒', () => {
    const d = reminder.loadReminderSettings();
    check('默认 2GB/10GB/3GB/90天/7天', d.usageLimitBytes === 2 * GB && d.diskFreeMinBytes === 10 * GB && d.diskFreeUrgentBytes === 3 * GB && d.staleDays === 90 && d.snoozeDays === 7 && d.snoozedUntil === null);
    localStorage.setItem('evidence-storage-reminder-v1', '{bad json');
    check('损坏的存储值回退默认', reminder.loadReminderSettings().staleDays === 90);
    localStorage.setItem('evidence-storage-reminder-v1', JSON.stringify({ usageLimitBytes: -5, staleDays: 'x', diskFreeMinBytes: 20 * GB }));
    const partial = reminder.loadReminderSettings();
    check('非法字段回退默认、合法字段保留', partial.usageLimitBytes === 2 * GB && partial.staleDays === 90 && partial.diskFreeMinBytes === 20 * GB);
    reminder.saveReminderSettings({ ...d, staleDays: 30 });
    check('保存后读回', reminder.loadReminderSettings().staleDays === 30);
    const snoozed = reminder.snoozeReminder(NOW);
    check('稍后提醒 = now + snoozeDays', snoozed.snoozedUntil === NOW + 7 * DAY && reminder.loadReminderSettings().snoozedUntil === NOW + 7 * DAY);
    localStorage.clear();
  });

  const settings = { ...reminder.DEFAULT_REMINDER_SETTINGS };
  const sys = (id, overrides = {}) => ({ projectId: id, updatedAt: NOW - 200 * DAY, imageCount: 3, imageBytes: 100, archived: false, needsMigration: false, ...overrides });
  const evalWith = (input, s = settings) => reminder.evaluateReminder({ usageBytes: null, diskFree: null, systems: [], ...input }, s, NOW);
  const kinds = (r) => r.reasons.map((x) => x.kind).sort().join();

  await test('evaluateReminder 各条件', () => {
    check('无输入 → none', evalWith({}).level === 'none' && evalWith({}).reasons.length === 0);
    check('占用未超 → none', evalWith({ usageBytes: 2 * GB }).level === 'none');
    const usage = evalWith({ usageBytes: 2 * GB + 1 });
    check('占用超上限 → normal/usage', usage.level === 'normal' && kinds(usage) === 'usage');
    const low = evalWith({ diskFree: { drive: 'C:', freeBytes: 9 * GB, totalBytes: 100 * GB } });
    check('磁盘低于下限 → normal/disk-low', low.level === 'normal' && kinds(low) === 'disk-low');
    const urgent = evalWith({ diskFree: { drive: 'C:', freeBytes: 2 * GB, totalBytes: 100 * GB } });
    check('磁盘低于紧急线 → urgent，只报 disk-urgent', urgent.level === 'urgent' && kinds(urgent) === 'disk-urgent');
    check('磁盘充足 → none', evalWith({ diskFree: { drive: 'C:', freeBytes: 50 * GB, totalBytes: 100 * GB } }).level === 'none');
  });

  await test('久未修改候选', () => {
    const r = evalWith({ systems: [
      sys('old-small', { imageBytes: 10 }),
      sys('old-big', { imageBytes: 500 }),
      sys('recent', { updatedAt: NOW - 10 * DAY }),
      sys('archived', { archived: true }),
      sys('empty', { imageCount: 0, imageBytes: 0 }),
      sys('unmigrated', { needsMigration: true }),
    ] });
    check('命中 stale', r.level === 'normal' && kinds(r) === 'stale');
    check('候选只含未归档/有图/已整理/超期，按占用降序', r.staleCandidates.map((c) => c.projectId).join() === 'old-big,old-small');
    check('staleBytes 合计', r.staleBytes === 510);
    const boundary = evalWith({ systems: [sys('edge', { updatedAt: NOW - 90 * DAY })] });
    check('恰好 90 天不算', boundary.level === 'none');
  });

  await test('稍后提醒', () => {
    const snoozed = { ...settings, snoozedUntil: NOW + DAY };
    const n = evalWith({ usageBytes: 3 * GB }, snoozed);
    check('snooze 期间 normal 不显示且标记 snoozed', n.level === 'none' && n.snoozed === true && n.reasons.length === 1);
    const u = evalWith({ usageBytes: 3 * GB, diskFree: { drive: 'C:', freeBytes: 1 * GB, totalBytes: 100 * GB } }, snoozed);
    check('snooze 期间 urgent 仍显示并带上其它原因', u.level === 'urgent' && kinds(u) === 'disk-urgent,usage');
    const expired = evalWith({ usageBytes: 3 * GB }, { ...settings, snoozedUntil: NOW - 1 });
    check('snooze 过期后恢复提醒', expired.level === 'normal' && expired.snoozed === false);
  });

  const realFetch = window.fetch;
  await test('磁盘剩余读取', async () => {
    window.evidenceArchive = { diskFree: async () => ({ drive: 'D:', freeBytes: 5 * GB, totalBytes: 50 * GB }) };
    const desktop = await reminder.getDataDiskFree();
    check('桌面经 evidenceArchive.diskFree', desktop && desktop.drive === 'D:' && desktop.freeBytes === 5 * GB);
    window.evidenceArchive = { diskFree: async () => { throw new Error('statfs 失败'); } };
    check('桌面读取失败 → null', (await reminder.getDataDiskFree()) === null);
    delete window.evidenceArchive;

    let seenHeader = null;
    let seenUrl = null;
    window.fetch = async (url, init) => {
      seenUrl = String(url);
      seenHeader = new Headers(init && init.headers).get('x-evidence-control');
      return new Response(JSON.stringify({ drive: 'C:', freeBytes: 7 * GB, totalBytes: 100 * GB }), { headers: { 'Content-Type': 'application/json' } });
    };
    const web = await reminder.getDataDiskFree();
    check('Web 经本机服务并带控制标识', web && web.freeBytes === 7 * GB && seenHeader === '1' && seenUrl.endsWith('/api/control/disk-free'));
    window.fetch = async () => new Response(JSON.stringify({ drive: 'C:', freeBytes: 'lots' }), { headers: { 'Content-Type': 'application/json' } });
    check('响应字段无效 → null', (await reminder.getDataDiskFree()) === null);
    window.fetch = async () => new Response(JSON.stringify({ message: 'x' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    check('接口拒绝 → null', (await reminder.getDataDiskFree()) === null);
    window.fetch = realFetch;
    // 真实请求：用例页的服务器没有这个接口（返回 HTML），必须视为未知而不是报错。
    check('接口不存在（旧脚本/开发服务器）→ null', (await reminder.getDataDiskFree()) === null);
  });
  window.fetch = realFetch;

  await test('持久存储申请', async () => {
    const storage = navigator.storage;
    const original = { persisted: storage.persisted, persist: storage.persist };
    let persistCalls = 0;
    try {
      storage.persisted = async () => true;
      storage.persist = async () => { persistCalls += 1; return true; };
      check('已持久 → granted 且不再申请', (await persistence.requestPersistence()) === 'granted' && persistCalls === 0);
      storage.persisted = async () => false;
      storage.persist = async () => { persistCalls += 1; return false; };
      check('未批准 → denied，申请一次', (await persistence.requestPersistence()) === 'denied' && persistCalls === 1);
      check('查询状态不触发申请', (await persistence.getPersistenceState()) === 'denied' && persistCalls === 1);
      storage.persist = async () => { throw new Error('boom'); };
      check('申请抛错 → denied', (await persistence.requestPersistence()) === 'denied');
      storage.persisted = undefined;
      storage.persist = undefined;
      check('不支持 → unsupported', (await persistence.requestPersistence()) === 'unsupported' && (await persistence.getPersistenceState()) === 'unsupported');
    } finally {
      delete storage.persisted;
      delete storage.persist;
      if (storage.persisted !== original.persisted) { storage.persisted = original.persisted; storage.persist = original.persist; }
    }
  });

  return { results };
}
