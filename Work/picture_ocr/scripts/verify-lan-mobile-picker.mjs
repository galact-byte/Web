import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const collectorSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/LanMobileCollector.tsx'), 'utf8');
const dialogSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/LanCollectorDialog.tsx'), 'utf8');
const projectListSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/ProjectList.tsx'), 'utf8');
const projectListHeaderSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/project-list/ProjectListHeader.tsx'), 'utf8');

assert.match(collectorSource, /accept="image\/png,image\/jpeg,image\/gif,image\/webp,image\/bmp"/, '手机采集应仅请求服务端和报告导出均支持的图片格式。');
assert.doesNotMatch(collectorSource, /capture="environment"/, '手机采集不应强制直接打开后置相机，以便 Android、iOS 和 HarmonyOS 在同一入口提供拍照或选图。');
assert.doesNotMatch(dialogSource, />关闭<\/button>/, '会话对话框不应同时提供右上角 × 和重复的底部“关闭”按钮。');
assert.match(dialogSource, /'停止会话'/, '已启动会话时，底部应保留明确的“停止会话”操作。');
assert.match(projectListSource, /grid-cols-\[44px_minmax\(0,1fr\)_auto\]/, '窄窗口下项目列表应收敛为选择、系统名和操作三列。');
assert.match(projectListSource, /lg:grid-cols-\[44px_minmax\(0,1\.3fr\)_minmax\(0,0\.85fr\)_minmax\(0,0\.95fr\)_64px_auto\]/, '较宽窗口下项目列表应恢复详情列。');
assert.match(projectListSource, /<details className="relative 2xl:hidden">/, '中等宽度下低频系统操作应收纳在“更多操作”菜单中。');
assert.match(projectListSource, /hidden 2xl:flex/, '宽屏应保留完整的快捷操作按钮。');
assert.match(projectListHeaderSource, /flex-wrap/, '项目列表顶栏在低宽度下应允许搜索和操作按钮换行。');
assert.match(projectListHeaderSource, /basis-full/, '项目列表搜索框在窄窗口下应占满一行。');
assert.match(projectListHeaderSource, /xl:w-\[320px\]/, '项目列表搜索框只可在宽屏恢复固定宽度。');

console.log('局域网采集与响应式项目列表验证通过：保留一个系统图片入口，移除重复关闭按钮，并在窄窗口收纳低频操作。');
