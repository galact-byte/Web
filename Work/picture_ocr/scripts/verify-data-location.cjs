// 验证桌面数据目录迁移逻辑：迁移复制、缓存跳过、指针不外泄、备份记录、
// 过期清理、手动删除备份、不可用目录回退。用假的 electron 模块在临时目录上跑。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evd-dataloc-'));
const appData = path.join(tmpRoot, 'AppData', 'Roaming');
const APP_NAME = '测评证据采集工具';
const defaultUserData = path.join(appData, APP_NAME);

let userDataPath = defaultUserData;
let dialogResult = { canceled: true, filePaths: [] };

const mockElectron = {
  app: {
    getPath: (key) => (key === 'appData' ? appData : userDataPath),
    getName: () => APP_NAME,
    setPath: (key, value) => { if (key === 'userData') userDataPath = value; },
    relaunch: () => {},
    exit: () => {},
  },
  dialog: { showOpenDialog: async () => dialogResult },
};

// 拦截 require('electron')
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return mockElectron;
  return origLoad.apply(this, arguments);
};

function freshModule() {
  delete require.cache[require.resolve('../electron/dataLocation.cjs')];
  return require('../electron/dataLocation.cjs');
}

const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

function seedDefaultUserData() {
  fs.rmSync(defaultUserData, { recursive: true, force: true });
  fs.mkdirSync(path.join(defaultUserData, 'IndexedDB', 'https_x'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb'), 'dbdata');
  fs.mkdirSync(path.join(defaultUserData, 'Local Storage'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'Local Storage', 'leveldb.log'), 'ls');
  fs.mkdirSync(path.join(defaultUserData, 'GPUCache'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'GPUCache', 'cache'), 'junk');
}

(async () => {
  // 场景1：默认位置、无配置 → init 不改位置
  seedDefaultUserData();
  userDataPath = defaultUserData;
  let dl = freshModule();
  dl.init();
  check('无配置时保持默认 userData', userDataPath === defaultUserData);
  check('无配置时 isDefault=true', dl.getLocationInfo().isDefault === true);

  // 场景2：选择新目录 → 写迁移标记（此时不复制）
  const chosenParent = path.join(tmpRoot, 'D_drive');
  const target = path.join(chosenParent, dl.DATA_SUBDIR);
  dialogResult = { canceled: false, filePaths: [chosenParent] };
  const chooseRes = await dl.chooseLocation({});
  check('chooseLocation 返回 needRestart', chooseRes.changed === true && chooseRes.needRestart === true);
  check('choose 后目标尚未有数据（复制留待重启）', !fs.existsSync(path.join(target, 'IndexedDB')));
  const cfgPath = path.join(defaultUserData, 'data-location.json');
  check('choose 写入 migration 标记', JSON.parse(fs.readFileSync(cfgPath, 'utf8')).migration != null);

  // 场景3：模拟重启 → init 处理迁移标记：复制到新目录、切换、记备份
  userDataPath = defaultUserData; // 重启初态回到默认，由 init 决定
  dl = freshModule();
  dl.init();
  check('重启后 userData 切到目标', userDataPath === target);
  check('目标含 IndexedDB 数据', fs.readFileSync(path.join(target, 'IndexedDB', 'https_x', '000001.ldb'), 'utf8') === 'dbdata');
  check('目标含 Local Storage', fs.existsSync(path.join(target, 'Local Storage', 'leveldb.log')));
  check('缓存目录 GPUCache 被跳过', !fs.existsSync(path.join(target, 'GPUCache')));
  check('指针未被复制到目标', !fs.existsSync(path.join(target, 'data-location.json')));
  const info3 = dl.getLocationInfo();
  check('迁移后 isDefault=false', info3.isDefault === false);
  check('迁移后有备份记录', info3.backup && info3.backup.dir === defaultUserData);
  check('备份剩余天数约 7', info3.backup.remainingDays >= 6 && info3.backup.remainingDays <= 7);
  check('原默认目录仍保留数据（备份）', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));

  // 场景4：备份未过期 → cleanup 不删
  dl.cleanupExpiredBackup();
  check('未过期备份不被清理', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));

  // 场景5：把备份 createdAt 改为 8 天前 → cleanup 删除旧 store 但保留指针
  {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.backup.createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  }
  dl.cleanupExpiredBackup();
  check('过期备份的旧 store 被清理', !fs.existsSync(path.join(defaultUserData, 'IndexedDB')));
  check('过期清理保留指针文件', fs.existsSync(cfgPath));
  check('清理后 backup 字段移除', dl.getLocationInfo().backup === undefined);

  // 场景6：恢复默认 → 迁移标记 → 重启复制回默认
  const infoBefore = dl.getLocationInfo();
  check('恢复前当前为自定义', infoBefore.isDefault === false);
  const resetRes = dl.resetLocation();
  check('resetLocation 返回 needRestart', resetRes.changed === true && resetRes.needRestart === true);
  userDataPath = defaultUserData; // 真实重启：新进程 userData 总从 OS 默认位置起步（setPath 尚未执行）
  dl = freshModule();
  dl.init();
  check('恢复默认后 userData 回到默认', userDataPath === defaultUserData);
  check('默认目录重新含数据', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));
  check('恢复后 isDefault=true', dl.getLocationInfo().isDefault === true);
  check('恢复后备份指向旧自定义目录', dl.getLocationInfo().backup && dl.getLocationInfo().backup.dir === target);

  // 场景7：手动立即删除备份（自定义目录整删）
  const delRes = dl.deleteBackup();
  check('deleteBackup 成功', delRes.deleted === true);
  check('自定义备份目录被删除', !fs.existsSync(target));
  check('删除后 backup 字段移除', dl.getLocationInfo().backup === undefined);

  // 场景8：指针指向不存在/不可写目录 → 回退默认 + 告警
  {
    // 在只读式不可用场景较难在临时盘构造，改为用一个“文件占位”当目录制造 mkdir 失败
    const badBase = path.join(tmpRoot, 'bad');
    fs.writeFileSync(badBase, 'not a dir');
    const badDir = path.join(badBase, 'sub'); // 父是文件 → mkdir 必失败
    fs.writeFileSync(cfgPath, JSON.stringify({ version: 1, dataDir: badDir }));
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('不可用目录时回退默认', userDataPath === defaultUserData);
    check('不可用目录时给出启动告警', typeof dl.getLocationInfo().startupWarning === 'string');
  }

  // 清理临时目录
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.error('FAILED:', failed.map((f) => f.name).join('; ')); process.exit(1); }
})();
