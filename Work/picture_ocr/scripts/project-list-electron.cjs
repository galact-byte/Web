// 正式桌面入口使用临时 userData；不接触用户数据目录及其备份。
const { app } = require('electron');
if (!process.env.PROJECT_LIST_TEST_PROFILE) throw new Error('缺少隔离 profile');
app.setPath('userData', process.env.PROJECT_LIST_TEST_PROFILE);
// 自动化窗口可能被终端遮挡；保持测试计时器运行，避免暂停等待随遮挡被节流。
app.on('browser-window-created', (_event, win) => win.webContents.setBackgroundThrottling(false));
require('../electron/main.cjs');
