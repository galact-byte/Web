import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export async function startWeb({ built = false, shortBodyDeadlines = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'picture-ocr-lan-test-'));
  const port = await freePort();
  let child;
  let output = '';
  const stop = async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  };
  try {
    if (built) await cp('dist', path.join(root, 'dist'), { recursive: true });
    else {
      await mkdir(path.join(root, 'dist'));
      await writeFile(path.join(root, 'dist/index.html'), '<!doctype html><title>Isolated LAN test</title>');
    }
    // 只替换隔离副本的网卡发现，不监听真实 LAN，不复用用户服务或用户库。
    let source = (await readFile('start-server.ps1', 'utf8')).replace(/function Get-PrivateLanAddresses \{[\s\S]*?\nfunction Get-FreePort/, "function Get-PrivateLanAddresses { @([pscustomobject]@{name='isolated';address='127.0.0.2'}) }\nfunction Get-FreePort");
    if (shortBodyDeadlines) source = source.replace('deadline.Change(45000,', 'deadline.Change(1200,').replace('deadline.Change(10000,', 'deadline.Change(1000,');
    await writeFile(path.join(root, 'start-server.ps1'), source);
    child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'start-server.ps1'), '-Port', String(port), '-NoBrowser'], { cwd: root, windowsHide: true });
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const base = `http://127.0.0.1:${port}`;
    const control = async (route, body) => {
      const response = await fetch(`${base}/api/control/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-evidence-control': '1', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(2000) });
      return { status: response.status, data: await response.json() };
    };
    for (let i = 0; i < 50; i++) {
      try { assert.equal((await control('status')).status, 200); return { root, port, base, control, stop, output: () => output }; }
      catch { if (child.exitCode !== null) break; await delay(100); }
    }
    throw new Error(`Isolated server failed to start: ${output}`);
  } catch (error) { await stop(); throw error; }
}

export const snapshot = { groupId: 'test-group', groupTitle: '隔离测试', systems: [{ projectId: 'test-project', title: '采集测试系统', categories: [{ id: 'cat', name: '分类' }], assets: [{ id: 'asset', name: '资产', categoryId: 'cat', items: [{ id: 'item', label: '检查项', required: true, imageCount: 0 }] }] }] };
export const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
