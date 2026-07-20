/* 无测试框架：以 Node 内置 assert 验证局域网采集服务的安全边界与生命周期。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLanCollectorServer } = require('../electron/lanServer.cjs');

async function request(url, options) {
  return fetch(url, options);
}

async function main() {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-ocr-lan-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>LAN</title>');
  const uploads = [];
  const server = await createLanCollectorServer({
    staticDir,
    snapshot: {
      projectId: 'project-1',
      title: '验证系统',
      categories: [{ id: 'cat-1', name: '分类' }],
      assets: [{ id: 'asset-1', name: '资产', categoryId: 'cat-1', items: [{ id: 'item-1', label: '检查项', required: true, imageCount: 0 }] }],
    },
    onImage: (upload) => uploads.push(upload),
  });
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = server.token;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  try {
    assert.equal((await request(`${baseUrl}/api/session`)).status, 401, '未带令牌的快照请求必须被拒绝');
    assert.equal((await request(`${baseUrl}/api/session?token=wrong-token`)).status, 401, '随机令牌必须被拒绝');
    const snapshotResponse = await request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`);
    assert.equal(snapshotResponse.status, 200, '正确令牌应可读取快照');
    assert.equal((await snapshotResponse.json()).assets[0].items[0].id, 'item-1');

    assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=missing&itemId=item-1`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).status, 403, '不在白名单内的资产必须被拒绝');
    assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=missing`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).status, 403, '不在白名单内的检查项必须被拒绝');
    assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=item-1`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'not-image' })).status, 415, '非图片请求必须被拒绝');
    const oversizedPng = Buffer.alloc(10 * 1024 * 1024 + 1);
    png.copy(oversizedPng);
    assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=item-1`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: oversizedPng })).status, 413, '超限图片必须被拒绝');

    const validResponse = await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=item-1`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-file-name': encodeURIComponent('现场截图.png') }, body: png });
    assert.equal(validResponse.status, 201, '允许的图片应能上传');
    assert.equal(uploads.length, 1, '允许图片应通知桌面端');
    assert.equal(uploads[0].assetId, 'asset-1');
    assert.equal(uploads[0].image.fileName, '现场截图.png');
    assert.match(uploads[0].image.data, /^data:image\/png;base64,/);
  } finally {
    await server.close();
    fs.rmSync(staticDir, { recursive: true, force: true });
  }

  await assert.rejects(() => request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`), '会话关闭后 URL 必须失效');
  console.log('LAN 采集服务验证通过：认证、白名单、文件校验、上传通知与关闭失效均符合预期。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
