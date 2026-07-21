import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const collectorSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/LanMobileCollector.tsx'), 'utf8');
const dialogSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/LanCollectorDialog.tsx'), 'utf8');
const projectListSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/ProjectList.tsx'), 'utf8');
const projectListHeaderSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/project-list/ProjectListHeader.tsx'), 'utf8');
const appSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/App.tsx'), 'utf8');
const toolbarSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/Toolbar.tsx'), 'utf8');
const bridgeSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/utils/lanBridge.ts'), 'utf8');

assert.match(collectorSource, /accept="image\/png,image\/jpeg,image\/gif,image\/webp,image\/bmp"/, '手机采集应仅请求服务端和报告导出均支持的图片格式。');
assert.doesNotMatch(collectorSource, /capture="environment"/, '手机采集不应强制直接打开后置相机，以便 Android、iOS 和 HarmonyOS 在同一入口提供拍照或选图。');
assert.doesNotMatch(dialogSource, />关闭<\/button>/, '会话对话框不应同时提供右上角 × 和重复的底部“关闭”按钮。');
assert.match(dialogSource, /'停止会话'/, '已启动会话时，底部应保留明确的“停止会话”操作。');
assert.match(projectListSource, /grid-cols-\[44px_minmax\(0,1fr\)_160px\]/, '窄窗口下项目列表应收敛为选择、系统名和固定宽度操作列。');
assert.match(projectListSource, /const projectListGrid = 'grid-cols-\[44px_minmax\(0,1fr\)_160px\] lg:grid-cols-\[44px_minmax\(0,1\.3fr\)_minmax\(0,0\.85fr\)_minmax\(0,0\.95fr\)_64px_160px\] 2xl:grid-cols-\[44px_minmax\(0,1\.3fr\)_minmax\(0,0\.85fr\)_minmax\(0,0\.95fr\)_64px_448px\]';/, '表头与数据行必须复用按断点预留操作列宽度的同一网格模板。');
assert.match(projectListSource, /className=\{`\$\{projectListGrid\}/, '项目列表表头和数据行必须引用共享网格模板，避免列宽漂移。');
assert.match(projectListSource, /<details className="relative 2xl:hidden">/, '中等宽度下低频系统操作应收纳在“更多操作”菜单中。');
assert.match(projectListSource, /hidden 2xl:flex/, '宽屏应保留完整的快捷操作按钮。');
assert.match(projectListHeaderSource, /flex-wrap/, '项目列表顶栏在低宽度下应允许搜索和操作按钮换行。');
assert.match(projectListHeaderSource, /basis-full/, '项目列表搜索框在窄窗口下应占满一行。');
assert.match(projectListHeaderSource, /xl:w-\[320px\]/, '项目列表搜索框只可在宽屏恢复固定宽度。');
assert.match(bridgeSource, /updateSession:/, '统一局域网桥必须提供快照更新接口。');
assert.match(collectorSource, /window\.setInterval\(\(\) => void refreshSnapshot\(false, controller\.signal\), 2000\)/, '手机采集页必须每 2 秒同步最新项目快照。');
assert.match(collectorSource, /当前选择已调整/, '手机端删除当前选择时必须给出更新说明。');
assert.match(toolbarSource, /采集中/, '活动会话必须在工作台工具栏显示状态标识。');
assert.match(dialogSource, /关闭此窗口不会停止手机采集/, '关闭弹窗必须明确说明会话仍会继续。');
assert.doesNotMatch(projectListSource, /手机局域网采集/, '项目列表不应保留局域网采集入口。');
assert.match(appSource, /updateSession\(lanSnapshot\)/, '工作台会话运行期间必须提交最新快照。');

console.log('局域网采集与响应式项目列表验证通过：保留单一系统图片入口、可收起的活动会话、手机自动同步和自适应项目列表。');
