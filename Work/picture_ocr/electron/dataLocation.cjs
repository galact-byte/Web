// 桌面版数据目录迁移：指针 / 数据本体分离。
// C 盘（%APPDATA%\<应用名>）只保留几 KB 指针 data-location.json，
// 真正占地方的 IndexedDB / Local Storage 落在用户自选目录。
//
// 关键：实际的目录复制在“下次启动、Electron 尚未打开任何 store 之前”进行，
// 而不是在应用运行中复制——因为运行期 IndexedDB(leveldb) 的 LOCK/.ldb 文件在
// Windows 上处于占用状态，复制会失败或得到不一致快照。运行中的“更改目录/恢复默认”
// 只写一个 migration 标记并重启，重启早期再完成复制。
const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = 'data-location.json';
const DATA_SUBDIR = '测评证据采集数据';
const BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 备份保留 7 天
const DAY_MS = 24 * 60 * 60 * 1000;
// 复制时跳过的无关/易锁定缓存目录，以及指针本体（指针只应存在于默认位置）。
const COPY_SKIP = new Set(['GPUCache', 'Code Cache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'logs', CONFIG_FILE]);

let defaultUserData = null; // 默认 userData（%APPDATA%\<应用名>），启动早期捕获，后续不变
let startupWarning = null;

function samePath(a, b) {
  if (!a || !b) return false;
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function configPath() {
  // 指针永远放默认 userData 下，不随数据目录迁移而移动。
  return path.join(defaultUserData || app.getPath('userData'), CONFIG_FILE);
}

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (cfg && typeof cfg === 'object') return cfg;
  } catch {
    // 文件不存在 / 解析失败 → 视为默认位置
  }
  return {};
}

function writeConfig(cfg) {
  const target = configPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(cfg, null, 2), 'utf8');
}

function isDirWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.__probe__');
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

// 复制目录内容：跳过缓存/指针；复制而非移动，从不删除源。
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (COPY_SKIP.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(from, to, { recursive: true });
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

// 删除一份备份。defaultRoot 备份保留指针文件；自定义备份整目录删除。
// 安全护栏：绝不删除当前正在使用的 userData。
function deleteBackupDir(backup) {
  if (!backup || !backup.dir) return;
  if (samePath(backup.dir, app.getPath('userData'))) return;
  if (backup.isDefaultRoot) {
    for (const name of fs.readdirSync(backup.dir)) {
      if (name === CONFIG_FILE) continue;
      fs.rmSync(path.join(backup.dir, name), { recursive: true, force: true });
    }
  } else {
    // 自定义备份必是本工具建的数据子目录，避免误删用户放同目录的其它文件。
    if (path.basename(backup.dir) !== DATA_SUBDIR) return;
    fs.rmSync(backup.dir, { recursive: true, force: true });
  }
}

// 启动早期调用（app ready 之前）：处理待迁移标记 + 应用指针。
function init() {
  try {
    defaultUserData = app.getPath('userData');
    let cfg = readConfig();

    // 1) 处理上一次运行遗留的迁移标记：此刻 store 尚未打开，复制安全。
    if (cfg.migration && cfg.migration.from && cfg.migration.to) {
      const { from, to } = cfg.migration;
      try {
        if (fs.existsSync(from)) copyDir(from, to);
        cfg.backup = { dir: from, createdAt: Date.now(), isDefaultRoot: samePath(from, defaultUserData) };
        if (samePath(to, defaultUserData)) delete cfg.dataDir;
        else cfg.dataDir = to;
        delete cfg.migration;
        writeConfig(cfg);
      } catch (err) {
        // 复制失败：原数据完好，保持原位置，不切换。
        startupWarning = `数据迁移失败，已保持原位置：${err && err.message ? err.message : err}`;
        delete cfg.migration;
        try { writeConfig(cfg); } catch {}
      }
    }

    // 2) 应用指针
    if (cfg.dataDir) {
      if (isDirWritable(cfg.dataDir)) {
        app.setPath('userData', cfg.dataDir);
      } else {
        startupWarning = `自定义数据目录不可用，已临时使用默认位置：${cfg.dataDir}`;
      }
    }
  } catch (err) {
    // 任何异常都不得阻止应用启动。
    startupWarning = `数据目录配置读取失败，已使用默认位置：${err && err.message ? err.message : err}`;
  }
}

function backupInfo(cfg) {
  if (!cfg.backup || !cfg.backup.dir) return undefined;
  const age = Date.now() - (cfg.backup.createdAt || 0);
  const remainingDays = Math.max(0, Math.ceil((BACKUP_RETENTION_MS - age) / DAY_MS));
  return { dir: cfg.backup.dir, createdAt: cfg.backup.createdAt || 0, remainingDays };
}

function getLocationInfo() {
  const current = app.getPath('userData');
  const cfg = readConfig();
  return {
    current,
    isDefault: samePath(current, defaultUserData),
    defaultDir: defaultUserData,
    startupWarning: startupWarning || undefined,
    backup: backupInfo(cfg),
  };
}

// 运行中：弹目录选择框，写迁移标记（复制留待重启后进行）。
async function chooseLocation(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: '选择数据存储位置',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) return { changed: false };
  const chosen = result.filePaths[0];
  const target = path.join(chosen, DATA_SUBDIR);
  const current = app.getPath('userData');
  if (samePath(target, current)) return { changed: false, reason: '所选目录与当前位置相同。' };
  if (!isDirWritable(target)) return { changed: false, error: '目标目录不可写，请换一个位置。' };

  const cfg = readConfig();
  cfg.migration = { from: current, to: target, createdAt: Date.now() };
  writeConfig(cfg);
  return { changed: true, dataDir: target, needRestart: true };
}

// 运行中：恢复默认位置，写迁移标记（复制留待重启后进行）。
function resetLocation() {
  const current = app.getPath('userData');
  if (samePath(current, defaultUserData)) return { changed: false, reason: '当前已是默认位置。' };
  const cfg = readConfig();
  cfg.migration = { from: current, to: defaultUserData, createdAt: Date.now() };
  writeConfig(cfg);
  return { changed: true, needRestart: true };
}

function deleteBackup() {
  const cfg = readConfig();
  if (!cfg.backup) return { deleted: false };
  try {
    deleteBackupDir(cfg.backup);
    delete cfg.backup;
    writeConfig(cfg);
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: err && err.message ? err.message : String(err) };
  }
}

// app ready 之后后台调用：备份过期则清理。删除失败仅忽略，下次启动再试。
function cleanupExpiredBackup() {
  try {
    const cfg = readConfig();
    if (!cfg.backup || !cfg.backup.dir) return;
    const age = Date.now() - (cfg.backup.createdAt || 0);
    if (age < BACKUP_RETENTION_MS) return;
    deleteBackupDir(cfg.backup);
    delete cfg.backup;
    writeConfig(cfg);
  } catch {
    // 忽略：不影响使用
  }
}

module.exports = {
  DATA_SUBDIR,
  BACKUP_RETENTION_MS,
  init,
  getLocationInfo,
  chooseLocation,
  resetLocation,
  deleteBackup,
  cleanupExpiredBackup,
};
