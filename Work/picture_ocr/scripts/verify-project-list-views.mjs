import assert from 'node:assert/strict';
import { build } from 'esbuild';

// 直接运行生产派生逻辑，不复制实现；缺失实现时该测试应失败。
const { outputFiles } = await build({ entryPoints: ['src/components/project-list/projectListViews.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { splitProjectViews, filterSystems, filterGroups, filterGroupSystems, syncExpandedGroups, selectedVisibleSystems, listLocationKey } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const system = (id, groupId, name, updatedAt = 1) => ({ id, groupId, meta: { systemName: name, projectName: '', projectCode: '', unitName: '测试单位', reportDate: '' }, assetCount: 0, createdAt: 1, updatedAt });
const grouped = system('g1', 'multi', '交易平台');
const solo = system('solo', null, '独立门户', 3);
const orphan = system('orphan', 'missing', '档案系统');
const summaries = [
  { id: 'multi', group: { id: 'multi', projectName: '公共资源中心', updatedAt: 1 }, systems: [grouped, system('g2', 'multi', '办公系统')] },
  { id: 'single', group: { id: 'single', projectName: '一个系统的项目', updatedAt: 5 }, systems: [system('s1', 'single', '采购系统')] },
  { id: 'empty', group: { id: 'empty', projectName: '空项目', updatedAt: 2 }, systems: [] },
  { id: 'missing', group: null, systems: [orphan] },
  { id: solo.id, group: null, systems: [solo] },
];
const before = JSON.stringify(summaries);
const views = splitProjectViews(summaries);
assert.deepEqual(views.independent.map(s => s.id), ['solo']);
assert.equal(views.projects.length, 4, '单系统组、空组、异常组都必须可达');
assert.equal(views.projects[0].id, 'single', '按最近更新时间排序');
assert.equal(views.projects.filter(g => g.group).length, 3, '真实项目组和异常组分开计数');
assert.deepEqual(filterGroups(views.projects, '交易平台').map(g => g.id), ['multi']);
assert.deepEqual(filterSystems(summaries[0].systems, '交易').map(s => s.id), ['g1']);
assert.deepEqual(filterSystems([solo], '不存在'), []);
assert.deepEqual(selectedVisibleSystems([grouped], new Set(['g1', 'solo', 'deleted'])).map(s => s.id), ['g1'], '只允许当前可见选择');
assert.equal(JSON.stringify(summaries), before, '分类与搜索不修改原摘要');
assert.deepEqual(filterGroupSystems(summaries[0], '交易').map(s => s.id), ['g1'], '系统命中只展示匹配项');
assert.deepEqual(filterGroupSystems(summaries[0], '公共资源').map(s => s.id), ['g1', 'g2'], '项目字段命中展示全组');
assert.deepEqual(filterGroupSystems(summaries[3], '档案').map(s => s.id), ['orphan']);
assert.deepEqual(syncExpandedGroups(null, views.projects), views.projects.map(g => g.id), '首次默认全部展开');
assert.deepEqual(syncExpandedGroups([], views.projects), [], '全部收起后刷新不能重新展开');
const expanded = ['multi', 'deleted'];
assert.deepEqual(syncExpandedGroups(expanded, views.projects), ['multi'], '只清理已删除的项目');
assert.deepEqual(expanded, ['multi', 'deleted'], '展开同步不修改输入');
assert.equal(listLocationKey({ kind: 'groups' }), 'groups');
assert.equal(listLocationKey({ kind: 'independent' }), 'independent');
console.log('PASS 项目分类、单系统/空组/异常组、搜索范围、批量选择与输入不可变');
