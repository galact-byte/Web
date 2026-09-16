import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fixture = { group: null, docs: [], fail: false };
globalThis.__lanGroupFixture = fixture;
const result = await build({
  entryPoints: ['src/utils/lanGroupSnapshot.ts'], bundle: true, write: false, format: 'esm', platform: 'browser',
  plugins: [{ name: 'fixture-db', setup(build) {
    build.onResolve({ filter: /^\.\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      const f = globalThis.__lanGroupFixture;
      export async function listProjects() { return f.docs; }
      export async function loadProject(id) { return f.docs.find(doc => doc.id === id); }
      export async function loadProjectGroup() { if (f.fail) throw new Error('read failed'); return f.group; }
    ` }));
  } }],
});
const { buildGroupSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const doc = (id, groupId) => ({ id, groupId, meta: { projectName: '旧文档项目名', systemName: `系统 ${id}` }, categories: [], assets: [] });
fixture.docs = [doc('s1', 'g'), doc('s2', 'g'), doc('solo', null)];
fixture.group = { id: 'g', projectName: '已保存组名', unitName: '测试单位' };
let snapshot = await buildGroupSnapshot({ groupId: 'g', groupTitle: '' });
assert.equal(snapshot.groupTitle, '已保存组名');
assert.deepEqual(snapshot.systems.map(s => s.projectId), ['s1', 's2']);
fixture.group.projectName = '改名后的组名';
snapshot = await buildGroupSnapshot({ groupId: 'g', groupTitle: '过期缓存名', systemIds: ['s2'] });
assert.equal(snapshot.groupTitle, '改名后的组名');
assert.deepEqual(snapshot.systems.map(s => s.projectId), ['s2']);
fixture.group.projectName = '  ';
fixture.group.unitName = '  太原市行政审批服务管理局  ';
for (const groupTitle of ['', '旧名', '未命名项目组']) {
  snapshot = await buildGroupSnapshot({ groupId: 'g', groupTitle });
  assert.equal(snapshot.groupTitle, '太原市行政审批服务管理局');
  assert.deepEqual(snapshot.systems.map(s => s.projectId), ['s1', 's2']);
}
assert.equal((await buildGroupSnapshot({ groupId: 'g', systemIds: ['s1'] })).groupTitle, '太原市行政审批服务管理局');
fixture.group.unitName = '改名后的单位';
assert.equal((await buildGroupSnapshot({ groupId: 'g', groupTitle: '太原市行政审批服务管理局' })).groupTitle, '改名后的单位');
fixture.group.unitName = '  ';
assert.equal((await buildGroupSnapshot({ groupId: 'g', groupTitle: '旧名' })).groupTitle, '未命名项目组');
assert.equal((await buildGroupSnapshot({ groupId: 'g', systemIds: ['s1'] })).groupTitle, '系统 s1');
assert.equal((await buildGroupSnapshot({ groupId: null, groupTitle: '旧名', systemIds: ['solo'] })).groupTitle, '系统 solo');
fixture.group = null;
assert.equal((await buildGroupSnapshot({ groupId: 'g', groupTitle: '缺组展示名' })).groupTitle, '缺组展示名');
fixture.fail = true;
await assert.rejects(buildGroupSnapshot({ groupId: 'g' }), /read failed/);
delete globalThis.__lanGroupFixture;
console.log('PASS group snapshot: authoritative names, project-name priority, unit-name fallback/rename, explicit membership, empty/single/independent/missing groups and read failure');
