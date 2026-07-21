const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { createLanCollectorServer } = require('./lanServer.cjs');

const indexPath = path.resolve(__dirname, '..', 'dist', 'index.html');
let mainWindow = null;
let lanSession = null;
const pendingImageSaves = new Map();

function isExpectedRenderer(sender) {
  if (sender !== mainWindow?.webContents) return false;
  try {
    return path.resolve(fileURLToPath(sender.getURL())) === indexPath;
  } catch {
    return false;
  }
}

function isAllowedNavigation(url) {
  try {
    return path.resolve(fileURLToPath(url)) === indexPath;
  } catch {
    return false;
  }
}

function rejectPendingImageSaves(message) {
  for (const pending of pendingImageSaves.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error(message));
  }
  pendingImageSaves.clear();
}

function requestImageSave(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.reject(new Error('桌面工作台已关闭，无法保存图片。'));
  const requestId = crypto.randomBytes(16).toString('base64url');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingImageSaves.delete(requestId);
      reject(new Error('电脑端保存图片超时，请确认工作台仍保持打开。'));
    }, 20_000);
    pendingImageSaves.set(requestId, { resolve, reject, timeout });
    mainWindow.webContents.send('lan:image', { ...payload, requestId });
  });
}

function isPrivateIPv4(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function getLanIPv4Addresses() {
  const virtualAdapterPattern = /vmware|virtualbox|hyper-v|vethernet|docker|wsl|loopback|npcap|tunnel/i;
  const addresses = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const address of entries || []) {
      if (address.family === 'IPv4' && !address.internal && isPrivateIPv4(address.address)) addresses.push({ name, address: address.address });
    }
  }
  return addresses.sort((left, right) => {
    const leftIsVirtual = virtualAdapterPattern.test(left.name);
    const rightIsVirtual = virtualAdapterPattern.test(right.name);
    if (leftIsVirtual !== rightIsVirtual) return leftIsVirtual ? 1 : -1;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function getLanStatus() {
  if (!lanSession) return { running: false, url: null, addresses: getLanIPv4Addresses() };
  return { running: true, url: lanSession.url, addresses: getLanIPv4Addresses() };
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.categories) || !Array.isArray(value.assets)) throw new Error('采集快照无效。');
  const categories = value.categories
    .filter((category) => category && typeof category.id === 'string' && typeof category.name === 'string')
    .map((category) => ({ id: category.id, name: category.name.slice(0, 200) }));
  const categoryIds = new Set(categories.map((category) => category.id));
  const assets = value.assets
    .filter((asset) => asset && typeof asset.id === 'string' && typeof asset.name === 'string' && categoryIds.has(asset.categoryId) && Array.isArray(asset.items))
    .map((asset) => ({
      id: asset.id,
      name: asset.name.slice(0, 200),
      categoryId: asset.categoryId,
      items: asset.items
        .filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.required === 'boolean' && Number.isInteger(item.imageCount))
        .map((item) => ({ id: item.id, label: item.label.slice(0, 300), required: item.required, imageCount: Math.max(0, item.imageCount) })),
    }));
  if (categories.length === 0 || assets.length === 0) throw new Error('采集快照缺少可用分类或资产。');
  if (typeof value.projectId !== 'string' || value.projectId.length === 0 || value.projectId.length > 200) throw new Error('采集快照缺少项目标识。');
  return { projectId: value.projectId, title: typeof value.title === 'string' ? value.title.slice(0, 200) : '未命名采集系统', categories, assets };
}

async function stopLanSession() {
  rejectPendingImageSaves('局域网采集会话已停止。');
  if (!lanSession) return getLanStatus();
  const session = lanSession;
  lanSession = null;
  clearTimeout(session.expiryTimer);
  await session.server.close();
  return getLanStatus();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: '测评证据采集工具',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  win.webContents.on('render-process-gone', () => { void stopLanSession(); });
  win.loadFile(indexPath);
  win.on('closed', () => {
    rejectPendingImageSaves('桌面工作台已关闭。');
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

ipcMain.handle('lan:get-status', (event) => {
  if (!isExpectedRenderer(event.sender)) throw new Error('只有主工作台可查询局域网采集状态。');
  return getLanStatus();
});
ipcMain.handle('lan:stop-session', async (event) => {
  if (!isExpectedRenderer(event.sender)) throw new Error('只有主工作台可停止局域网采集会话。');
  return stopLanSession();
});
ipcMain.handle('lan:update-session', (event, snapshot) => {
  if (!isExpectedRenderer(event.sender)) throw new Error('只有主工作台可更新局域网采集会话。');
  if (!lanSession) throw new Error('采集会话已结束。');
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  if (normalizedSnapshot.projectId !== lanSession.projectId) throw new Error('不能用其他项目更新当前采集会话。');
  lanSession.server.updateSnapshot(normalizedSnapshot);
  return getLanStatus();
});
ipcMain.on('lan:image-saved', (event, requestId, outcome) => {
  if (!isExpectedRenderer(event.sender) || typeof requestId !== 'string') return;
  const pending = pendingImageSaves.get(requestId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingImageSaves.delete(requestId);
  if (outcome?.success) pending.resolve();
  else pending.reject(new Error(typeof outcome?.message === 'string' ? outcome.message : '电脑端未能保存图片。'));
});
ipcMain.handle('lan:start-session', async (event, snapshot, selectedAddress) => {
  if (!isExpectedRenderer(event.sender)) throw new Error('只有主工作台可启动局域网采集会话。');
  const addresses = getLanIPv4Addresses();
  if (addresses.length === 0) throw new Error('未检测到可用的局域网 IPv4 地址。请连接同一 Wi-Fi 或启用电脑连接的手机热点后重试。');
  const ip = typeof selectedAddress === 'string' && addresses.some((entry) => entry.address === selectedAddress)
    ? selectedAddress
    : addresses[0].address;
  const normalizedSnapshot = normalizeSnapshot(snapshot);

  await stopLanSession();
  const server = await createLanCollectorServer({
    staticDir: path.join(__dirname, '..', 'dist'),
    snapshot: normalizedSnapshot,
    host: ip,
    onImage: async (payload) => {
      if (lanSession?.server !== server) throw new Error('采集会话已结束。');
      await requestImageSave({ ...payload, projectId: lanSession.projectId });
    },
  });
  const url = `http://${ip}:${server.port}/#/lan/${server.token}`;
  const expiryTimer = setTimeout(() => {
    if (lanSession?.server === server) void stopLanSession();
  }, 2 * 60 * 60 * 1000);
  expiryTimer.unref();
  lanSession = { server, url, expiryTimer, projectId: normalizedSnapshot.projectId };
  return getLanStatus();
});

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('before-quit', () => { void stopLanSession(); });
app.on('window-all-closed', () => {
  void stopLanSession();
  if (process.platform !== 'darwin') app.quit();
});
