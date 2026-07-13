import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const dist = resolve('dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

for (const file of requiredFiles) {
  const path = resolve(dist, file);
  if (!existsSync(path) || statSync(path).size === 0) {
    throw new Error(`PWA 构建产物缺失或为空：dist/${file}`);
  }
}

const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest') || !html.includes('theme-color')) {
  throw new Error('index.html 未声明 PWA manifest 或主题色。');
}

const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.start_url !== './#/mobile' || manifest.display !== 'standalone' || !Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  throw new Error('manifest.webmanifest 缺少手机入口、standalone 显示模式或图标。');
}

const serviceWorker = readFileSync(resolve(dist, 'service-worker.js'), 'utf8');
for (const requiredSnippet of [
  "self.skipWaiting()",
  'self.clients.claim()',
  "path.endsWith('.evidence')",
  'request.mode === \'navigate\'',
  'PRECACHE_URLS',
]) {
  if (!serviceWorker.includes(requiredSnippet)) {
    throw new Error(`Service Worker 缺少预期安全或离线逻辑：${requiredSnippet}`);
  }
}
if (serviceWorker.includes('.evidence",') || serviceWorker.includes(".evidence',")) {
  throw new Error('Service Worker 预缓存清单不应包含 .evidence 用户文件。');
}

const precacheMatch = serviceWorker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
if (!precacheMatch) throw new Error('Service Worker 未生成可解析的预缓存清单。');
const precacheUrls = JSON.parse(precacheMatch[1]);
const listedUrls = new Set(precacheUrls);
const ignoredExtensions = new Set(['.evidence', '.zip', '.docx']);

function listBuildAssets(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (path === resolve(dist, 'service-worker.js')) return [];
    return entry.isDirectory() ? listBuildAssets(path) : [path];
  });
}

for (const assetPath of listBuildAssets(dist)) {
  const url = `./${relative(dist, assetPath).replaceAll('\\', '/')}`;
  if (![...ignoredExtensions].some((extension) => url.toLowerCase().endsWith(extension)) && !listedUrls.has(url)) {
    throw new Error(`Service Worker 未预缓存构建静态资源：${url}`);
  }
}
for (const url of precacheUrls) {
  if (!url.startsWith('./') || !existsSync(resolve(dist, url.slice(2)))) {
    throw new Error(`Service Worker 包含不存在或非相对路径的预缓存资源：${url}`);
  }
}

console.log('PWA 构建产物、manifest、图标、完整预缓存清单和 Service Worker 离线安全边界验证通过。');
