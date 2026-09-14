// 正式桌面入口使用临时 userData；不接触用户数据目录及其备份。
const { app } = require('electron');
if (!process.env.PROJECT_LIST_TEST_PROFILE) throw new Error('缺少隔离 profile');
app.setPath('userData', process.env.PROJECT_LIST_TEST_PROFILE);
require('../electron/main.cjs');
