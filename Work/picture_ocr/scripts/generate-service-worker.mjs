import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const distDirectory = resolve('dist');
const serviceWorkerPath = resolve(distDirectory, 'service-worker.js');
const ignoredExtensions = new Set(['.evidence', '.zip', '.docx']);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (path === serviceWorkerPath) return [];
    if (entry.isDirectory()) return listFiles(path);
    return [path];
  });
}

function isCacheableBuildAsset(path) {
  const url = `./${relative(distDirectory, path).replaceAll('\\', '/')}`;
  return ![...ignoredExtensions].some((extension) => url.toLowerCase().endsWith(extension));
}

if (!statSync(distDirectory).isDirectory()) {
  throw new Error('未找到 dist/；请先运行 Vite 构建。');
}

const assets = listFiles(distDirectory)
  .filter(isCacheableBuildAsset)
  .map((path) => `./${relative(distDirectory, path).replaceAll('\\', '/')}`)
  .sort();
const cacheVersion = createHash('sha256')
  .update(assets.map((url) => `${url}:${createHash('sha256').update(readFileSync(resolve(distDirectory, url.slice(2)))).digest('hex')}`).join('\n'))
  .digest('hex')
  .slice(0, 12);
const source = `/* 此文件由 scripts/generate-service-worker.mjs 自动生成；不要手动编辑。 */
const CACHE_NAME = 'picture-ocr-static-${cacheVersion}';
const PRECACHE_URLS = ${JSON.stringify(assets, null, 2)};
const NAVIGATION_FALLBACK = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('picture-ocr-static-') && key !== CACHE_NAME)
    .map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

function isUserDataRequest(request, url) {
  const path = url.pathname.toLowerCase();
  return request.method !== 'GET'
    || path.endsWith('.evidence')
    || path.endsWith('.zip')
    || path.endsWith('.docx')
    || request.headers.has('content-disposition');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isUserDataRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(NAVIGATION_FALLBACK)));
    return;
  }

  // 只响应生成时明确列出的静态资源；绝不把运行时请求写入缓存，避免触及用户文件或业务数据。
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;

mkdirSync(distDirectory, { recursive: true });
writeFileSync(serviceWorkerPath, source, 'utf8');
console.log(`已生成 Service Worker：${assets.length} 个预缓存构建资源，缓存版本 ${cacheVersion}。`);
