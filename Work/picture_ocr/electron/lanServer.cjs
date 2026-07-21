const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 4;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']);
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function safeFileName(value) {
  let decoded = typeof value === 'string' ? value : '';
  try { decoded = decodeURIComponent(decoded); } catch { /* 保留原值并继续净化。 */ }
  const cleaned = decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  return cleaned || `mobile-${Date.now()}.image`;
}

function isAllowedImage(type, bytes) {
  if (!IMAGE_TYPES.has(type)) return false;
  if (type === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/gif') return bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a');
  if (type === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'image/bmp') return bytes.length >= 2 && bytes.subarray(0, 2).toString('ascii') === 'BM';
  return false;
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(request.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      request.resume();
      const error = new Error('图片超过 10MB 限制');
      error.statusCode = 413;
      reject(error);
      return;
    }
    const chunks = [];
    let size = 0;
    let oversized = false;
    request.on('data', (chunk) => {
      if (oversized) return;
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (oversized) {
        const error = new Error('图片超过 10MB 限制');
        error.statusCode = 413;
        reject(error);
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

function createAllowedItems(snapshot) {
  const allowedItems = new Map();
  for (const asset of snapshot.assets) {
    allowedItems.set(asset.id, new Set(asset.items.map((item) => item.id)));
  }
  return allowedItems;
}

const STATIC_CONTENT_SECURITY_POLICY = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'none'";

function serveStatic(staticDir, pathname, requestMethod, response) {
  if (requestMethod !== 'GET' && requestMethod !== 'HEAD') { sendJson(response, 405, { message: '仅支持读取静态资源。' }); return; }
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let decodedPath;
  try { decodedPath = decodeURIComponent(requestedPath); } catch { sendJson(response, 400, { message: '无效路径' }); return; }
  const root = path.resolve(staticDir);
  const filePath = path.resolve(root, `.${decodedPath}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) { sendJson(response, 403, { message: '禁止访问该路径' }); return; }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { sendJson(response, 404, { message: '资源不存在' }); return; }
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'content-type': CONTENT_TYPES.get(extension) || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': STATIC_CONTENT_SECURITY_POLICY,
  });
  if (requestMethod === 'HEAD') { response.end(); return; }
  fs.createReadStream(filePath).pipe(response);
}

async function createLanCollectorServer({ staticDir, snapshot, onImage, port = 0, host = '127.0.0.1' }) {
  if (!fs.existsSync(path.join(staticDir, 'index.html'))) throw new Error('局域网采集服务未找到构建后的 index.html。请先运行 npm run build。');
  const token = crypto.randomBytes(32).toString('base64url');
  let currentSnapshot = snapshot;
  let currentAllowedItems = createAllowedItems(snapshot);
  let closed = false;
  let activeUploads = 0;
  let uploadQueue = Promise.resolve();

  const sockets = new Set();
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://lan.local');
    const isApi = requestUrl.pathname.startsWith('/api/');
    if (isApi && requestUrl.searchParams.get('token') !== token) {
      sendJson(response, 401, { message: '采集会话无效或已结束。' });
      return;
    }
    if (requestUrl.pathname === '/api/session') {
      if (request.method !== 'GET') { sendJson(response, 405, { message: '不支持的请求方法' }); return; }
      sendJson(response, 200, currentSnapshot);
      return;
    }
    if (requestUrl.pathname === '/api/upload') {
      if (request.method !== 'POST') { sendJson(response, 405, { message: '不支持的请求方法' }); return; }
      const assetId = requestUrl.searchParams.get('assetId') || '';
      const itemId = requestUrl.searchParams.get('itemId') || '';
      if (!currentAllowedItems.get(assetId)?.has(itemId)) { sendJson(response, 403, { message: '目标资产或检查项不属于本次采集会话。' }); return; }
      const contentType = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(contentType)) { sendJson(response, 415, { message: '仅支持 PNG、JPEG、GIF、WebP 或 BMP 图片。' }); return; }
      if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
        request.resume();
        sendJson(response, 429, { message: '待保存图片过多，请等待电脑端完成当前图片后重试。' });
        return;
      }
      activeUploads += 1;
      try {
        const bytes = await collectBody(request);
        if (!isAllowedImage(contentType, bytes)) { const error = new Error('图片内容与声明类型不一致，上传已拒绝。'); error.statusCode = 415; throw error; }
        const image = {
          fileName: safeFileName(request.headers['x-file-name']),
          data: `data:${contentType};base64,${bytes.toString('base64')}`,
          mimeType: contentType,
        };
        const queuedUpload = uploadQueue.then(() => onImage({ assetId, itemId, image }));
        // 即使当前上传失败，也要继续处理后续上传，避免一个失败永久阻塞会话。
        uploadQueue = queuedUpload.catch(() => undefined);
        await queuedUpload;
        sendJson(response, 201, { message: '图片已写入电脑项目。' });
      } catch (error) {
        const statusCode = error && typeof error === 'object' && 'statusCode' in error && (error.statusCode === 413 || error.statusCode === 415) ? error.statusCode : 503;
        sendJson(response, statusCode, { message: error instanceof Error ? error.message : '写入电脑项目失败。' });
      } finally {
        activeUploads -= 1;
      }
      return;
    }
    if (isApi) { sendJson(response, 404, { message: '接口不存在' }); return; }
    serveStatic(staticDir, requestUrl.pathname, request.method || 'GET', response);
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法确定局域网服务端口。');

  return {
    token,
    port: address.port,
    updateSnapshot: (nextSnapshot) => {
      const nextAllowedItems = createAllowedItems(nextSnapshot);
      currentSnapshot = nextSnapshot;
      currentAllowedItems = nextAllowedItems;
    },
    close: () => new Promise((resolve) => {
      if (closed) { resolve(); return; }
      closed = true;
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    }),
  };
}

module.exports = { createLanCollectorServer, MAX_IMAGE_BYTES };
