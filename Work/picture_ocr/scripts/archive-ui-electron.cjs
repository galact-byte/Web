// 归档界面测试的正式桌面入口：临时 userData，目录选择框替换为临时目录（不弹原生对话框），其余走真实 main.cjs / IPC。
const { app, dialog } = require('electron');
if (!process.env.ARCHIVE_UI_PROFILE || !process.env.ARCHIVE_UI_DIR) throw new Error('缺少隔离 profile 或归档目录');
app.setPath('userData', process.env.ARCHIVE_UI_PROFILE);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [process.env.ARCHIVE_UI_DIR] });
app.on('browser-window-created', (_event, win) => win.webContents.setBackgroundThrottling(false));
require('../electron/main.cjs');
