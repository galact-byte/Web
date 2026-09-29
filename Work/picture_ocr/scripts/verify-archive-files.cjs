// electron/archiveFiles.cjs 的安全与落盘契约（纯 Node，桩掉系统对话框）。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createArchiveFiles, assertSafeName, driveOf } = require('../electron/archiveFiles.cjs');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-files-'));
  const dataDir = path.join(root, 'data');
  const outDir = path.join(root, 'out');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(outDir);
  let dialogResult = { canceled: false, filePaths: [outDir] };
  const files = createArchiveFiles({ showOpenDialog: async () => dialogResult, getDataDir: () => dataDir });
  let passed = 0;
  const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed += 1; }, (error) => { error.message = `${name}: ${error.message}`; throw error; });

  try {
    await ok('文件名净化', () => {
      for (const bad of ['../x.zip', '..\\x.zip', 'a/b.zip', 'C:\\x.zip', 'x.zip.', 'con?.zip', 'x.txt', '', 'a\u0000.zip', 'x'.repeat(250) + '.zip']) {
        assert.throws(() => assertSafeName(bad), undefined, bad);
      }
      assert.equal(assertSafeName('归档_项目一_系统A_20260929-1030.zip'), '归档_项目一_系统A_20260929-1030.zip');
    });

    await ok('取消选择返回 null', async () => {
      dialogResult = { canceled: true, filePaths: [] };
      assert.equal(await files.chooseDirectory(), null);
      dialogResult = { canceled: false, filePaths: [outDir] };
    });

    const target = await files.chooseDirectory();
    await ok('选择目录返回一次性 targetId 与盘符信息', () => {
      assert.match(target.targetId, /^[0-9a-f-]{36}$/);
      assert.equal(target.label, path.resolve(outDir));
      assert.equal(target.drive, driveOf(outDir));
      assert.equal(target.sameDriveAsData, true);
    });

    await ok('未知 targetId 被拒', async () => {
      await assert.rejects(files.writeFile('nope', 'a.zip', Buffer.from('x')), /失效/);
      await assert.rejects(files.readFile('nope', 'a.zip'), /失效/);
    });

    await ok('路径穿越文件名被拒且不落盘', async () => {
      await assert.rejects(files.writeFile(target.targetId, '..\\escape.zip', Buffer.from('x')));
      await assert.rejects(files.writeFile(target.targetId, '../escape.zip', Buffer.from('x')));
      assert.equal(fs.existsSync(path.join(root, 'escape.zip')), false);
    });

    const payload = Buffer.from(Array.from({ length: 70000 }, (_, i) => (i * 31) % 256));
    await ok('写后读回逐字节一致、无 partial 残留', async () => {
      assert.equal(await files.exists(target.targetId, 'a.zip'), false);
      await files.writeFile(target.targetId, 'a.zip', new Uint8Array(payload));
      assert.equal(await files.exists(target.targetId, 'a.zip'), true);
      const back = await files.readFile(target.targetId, 'a.zip');
      assert.ok(Buffer.compare(back, payload) === 0);
      assert.deepEqual(fs.readdirSync(outDir), ['a.zip']);
    });

    await ok('同名文件不覆盖', async () => {
      await assert.rejects(files.writeFile(target.targetId, 'a.zip', Buffer.from('other')), /已存在/);
      assert.ok(Buffer.compare(fs.readFileSync(path.join(outDir, 'a.zip')), payload) === 0);
      assert.deepEqual(fs.readdirSync(outDir), ['a.zip']);
    });

    await ok('空内容被拒', async () => {
      await assert.rejects(files.writeFile(target.targetId, 'b.zip', Buffer.alloc(0)), /大小/);
    });

    await ok('磁盘剩余返回数值', async () => {
      const free = await files.diskFree();
      assert.ok(free.freeBytes > 0 && free.totalBytes >= free.freeBytes);
      assert.match(free.drive, /^[A-Z]:$|^$/);
    });

    console.log(`verify-archive-files: ${passed} 项通过`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
