// 独立入口，不加载正式 main.cjs，不访问真实 userData 或备份清理逻辑。
const { app, BrowserWindow } = require('electron');
app.setPath('userData', process.env.DIAG_PROFILE);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  await win.loadURL(process.env.DIAG_URL);
  await win.webContents.executeJavaScript('window.evidenceData = {}; window.startDiagnosis()');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
