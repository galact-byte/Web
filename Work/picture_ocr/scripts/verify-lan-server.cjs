/* 无测试框架：以 Node 内置 assert 验证局域网采集服务的安全边界、组级多系统与生命周期。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLanCollectorServer } = require('../electron/lanServer.cjs');

async function request(url, options) {
  return fetch(url, options);
}

function uploadUrl(baseUrl, token, projectId, assetId, itemId) {
  const query = [`token=${encodeURIComponent(token)}`];
  if (projectId !== undefined) query.push(`projectId=${encodeURIComponent(projectId)}`);
  if (assetId !== undefined) query.push(`assetId=${encodeURIComponent(assetId)}`);
  if (itemId !== undefined) query.push(`itemId=${encodeURIComponent(itemId)}`);
  return `${baseUrl}/api/upload?${query.join('&')}`;
}

async function main() {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-ocr-lan-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>LAN</title>');
  const uploads = [];
  const server = await createLanCollectorServer({
    staticDir,
    snapshot: {
      groupId: 'group-1',
      groupTitle: '验证项目组',
      systems: [
        { projectId: 'project-1', title: '系统一', categories: [{ id: 'cat-1', name: '分类一' }], assets: [{ id: 'asset-1', name: '资产一', categoryId: 'cat-1', items: [{ id: 'item-1', label: '检查项一', required: true, imageCount: 0 }] }] },
        { projectId: 'project-2', title: '系统二', categories: [{ id: 'cat-2', name: '分类二' }], assets: [{ id: 'asset-2', name: '资产二', categoryId: 'cat-2', items: [{ id: 'item-2', label: '检查项二', required: false, imageCount: 0 }] }] },
      ],
    },
    onImage: (upload) => uploads.push(upload),
  });
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = server.token;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const postPng = (url, extraHeaders) => request(url, { method: 'POST', headers: { 'content-type': 'image/png', ...extraHeaders }, body: png });

  try {
    assert.equal((await request(`${baseUrl}/api/session`)).status, 401, '未带令牌的快照请求必须被拒绝');
    assert.equal((await request(`${baseUrl}/api/session?token=wrong-token`)).status, 401, '随机令牌必须被拒绝');
    const snapshotResponse = await request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`);
    assert.equal(snapshotResponse.status, 200, '正确令牌应可读取快照');
    const snapshotBody = await snapshotResponse.json();
    assert.equal(snapshotBody.systems.length, 2, '组快照必须包含全部系统');
    assert.equal(snapshotBody.systems[0].assets[0].items[0].id, 'item-1');
    assert.equal(snapshotBody.systems[1].projectId, 'project-2', '组快照必须区分不同系统');

    // 缺 projectId 或三元组不匹配必须被拒绝。
    assert.equal((await postPng(uploadUrl(baseUrl, token, undefined, 'asset-1', 'item-1'))).status, 403, '缺少系统标识的上传必须被拒绝');
    assert.equal((await postPng(uploadUrl(baseUrl, token, 'project-1', 'asset-2', 'item-2'))).status, 403, '跨系统（资产不属于该系统）的上传必须被拒绝');
    assert.equal((await postPng(uploadUrl(baseUrl, token, 'project-1', 'asset-1', 'missing'))).status, 403, '不在白名单内的检查项必须被拒绝');
    assert.equal((await request(uploadUrl(baseUrl, token, 'project-1', 'asset-1', 'item-1'), { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'not-image' })).status, 415, '非图片请求必须被拒绝');
    const oversizedPng = Buffer.alloc(10 * 1024 * 1024 + 1);
    png.copy(oversizedPng);
    assert.equal((await request(uploadUrl(baseUrl, token, 'project-1', 'asset-1', 'item-1'), { method: 'POST', headers: { 'content-type': 'image/png' }, body: oversizedPng })).status, 413, '超限图片必须被拒绝');

    // 系统一落库。
    const upload1 = await postPng(uploadUrl(baseUrl, token, 'project-1', 'asset-1', 'item-1'), { 'x-file-name': encodeURIComponent('现场截图.png') });
    assert.equal(upload1.status, 201, '系统一允许的图片应能上传');
    assert.equal(uploads.length, 1, '允许图片应通知桌面端');
    assert.equal(uploads[0].projectId, 'project-1', '上传必须携带目标系统标识');
    assert.equal(uploads[0].assetId, 'asset-1');
    assert.equal(uploads[0].image.fileName, '现场截图.png');
    assert.match(uploads[0].image.data, /^data:image\/png;base64,/);

    // 系统二落库：证明同一会话可为不同系统采集。
    const upload2 = await postPng(uploadUrl(baseUrl, token, 'project-2', 'asset-2', 'item-2'));
    assert.equal(upload2.status, 201, '系统二允许的图片应能上传');
    assert.equal(uploads.length, 2, '第二个系统的上传应继续通知桌面端');
    assert.equal(uploads[1].projectId, 'project-2', '第二个系统上传必须携带其系统标识');

    // 更新组快照（系统二结构变化），旧检查项失效、新检查项可用。
    server.updateSnapshot({
      groupId: 'group-1',
      groupTitle: '验证项目组',
      systems: [
        { projectId: 'project-1', title: '系统一', categories: [{ id: 'cat-1', name: '分类一' }], assets: [{ id: 'asset-1', name: '资产一', categoryId: 'cat-1', items: [{ id: 'item-1', label: '检查项一', required: true, imageCount: 1 }] }] },
        { projectId: 'project-2', title: '系统二', categories: [{ id: 'cat-2', name: '分类二' }], assets: [{ id: 'asset-3', name: '新增资产', categoryId: 'cat-2', items: [{ id: 'item-3', label: '新增检查项', required: true, imageCount: 0 }] }] },
      ],
    });
    const updatedSession = await request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`);
    assert.equal(updatedSession.status, 200, '更新后会话仍应可读取快照');
    assert.equal((await updatedSession.json()).systems[1].assets[0].id, 'asset-3', '手机必须读取最新组快照');
    assert.equal((await postPng(uploadUrl(baseUrl, token, 'project-2', 'asset-2', 'item-2'))).status, 403, '更新后系统二旧检查项必须被拒绝');
    assert.equal((await postPng(uploadUrl(baseUrl, token, 'project-2', 'asset-3', 'item-3'))).status, 201, '更新后系统二新增检查项应能上传');
    assert.equal(uploads.length, 3, '更新后允许图片应继续通知桌面端');
  } finally {
    await server.close();
    fs.rmSync(staticDir, { recursive: true, force: true });
  }

  await assert.rejects(() => request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`), '会话关闭后 URL 必须失效');
  console.log('LAN 采集服务验证通过：认证、三层白名单、跨系统落库、文件校验、上传通知与关闭失效均符合预期。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
