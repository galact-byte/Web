// 桌面端归档文件读写：渲染进程只拿到一次性 targetId，真实目录只保存在主进程，
// 文件名在主进程净化，渲染进程无法借此写任意路径。
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024; // 单个归档文件上限，防止异常数据写满磁盘
const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;

function driveOf(dir) {
  const root = path.parse(path.resolve(dir)).root;
  return root.replace(/[\\/]+$/, '').toUpperCase();
}

function assertSafeName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) throw new Error('归档文件名无效。');
  if (INVALID_NAME.test(name) || name !== path.basename(name) || name === '.' || name === '..' || name.endsWith('.') || name.endsWith(' ')) {
    throw new Error('归档文件名包含不允许的字符。');
  }
  if (!name.toLowerCase().endsWith('.zip')) throw new Error('归档文件必须是 .zip。');
  return name;
}

function toBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  throw new Error('归档内容格式无效。');
}

async function diskFreeOf(dir) {
  const stats = await fs.promises.statfs(dir);
  return { drive: driveOf(dir), freeBytes: Number(stats.bavail) * Number(stats.bsize), totalBytes: Number(stats.blocks) * Number(stats.bsize) };
}

/**
 * @param {{ showOpenDialog: (options: object) => Promise<{ canceled: boolean, filePaths: string[] }>, getDataDir: () => string }} deps
 */
function createArchiveFiles(deps) {
  const targets = new Map();

  function resolveTarget(targetId, name) {
    const dir = typeof targetId === 'string' ? targets.get(targetId) : undefined;
    if (!dir) throw new Error('归档目录已失效，请重新选择保存位置。');
    const file = path.join(dir, assertSafeName(name));
    if (path.dirname(file) !== dir) throw new Error('归档文件名无效。');
    return file;
  }

  return {
    async chooseDirectory() {
      const result = await deps.showOpenDialog({ title: '选择归档保存位置', properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled || !result.filePaths || !result.filePaths[0]) return null;
      const dir = path.resolve(result.filePaths[0]);
      await fs.promises.access(dir, fs.constants.W_OK);
      const targetId = crypto.randomUUID();
      targets.set(targetId, dir);
      const dataDrive = driveOf(deps.getDataDir());
      return { targetId, label: dir, drive: driveOf(dir), dataDrive, sameDriveAsData: driveOf(dir) === dataDrive };
    },

    async exists(targetId, name) {
      try {
        await fs.promises.access(resolveTarget(targetId, name));
        return true;
      } catch (error) {
        if (error && error.code === 'ENOENT') return false;
        throw error;
      }
    },

    /** 先写 .partial 并 fsync，再改名；已存在同名文件时拒绝（不覆盖旧归档）。 */
    async writeFile(targetId, name, bytes) {
      const file = resolveTarget(targetId, name);
      const buffer = toBuffer(bytes);
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_ARCHIVE_BYTES) throw new Error('归档内容大小无效。');
      const partial = `${file}.${crypto.randomBytes(4).toString('hex')}.partial`;
      const handle = await fs.promises.open(partial, 'wx');
      try {
        await handle.writeFile(buffer);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        try {
          await fs.promises.link(partial, file); // 原子且目标已存在时失败，不覆盖
        } catch (error) {
          if (error && error.code === 'EEXIST') throw new Error('同名归档文件已存在。');
          // FAT32/exFAT 等不支持硬链接的盘：先确认不存在再改名。
          if (fs.existsSync(file)) throw new Error('同名归档文件已存在。');
          await fs.promises.rename(partial, file);
        }
      } finally {
        await fs.promises.rm(partial, { force: true });
      }
    },

    async readFile(targetId, name) {
      return fs.promises.readFile(resolveTarget(targetId, name));
    },

    async diskFree() {
      return diskFreeOf(deps.getDataDir());
    },
  };
}

module.exports = { createArchiveFiles, driveOf, assertSafeName };
