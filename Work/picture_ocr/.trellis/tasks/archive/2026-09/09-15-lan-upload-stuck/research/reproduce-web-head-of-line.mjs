import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// 只启动脚本的隔离副本，不打开浏览器、不接触真实工作台或 IndexedDB。
const root = await mkdtemp(path.join(os.tmpdir(), 'picture-ocr-lan-diagnosis-'));
let child;
let idle;
let output = '';
try {
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist/index.html'), '<!doctype html><title>Isolated diagnosis</title>');
  await copyFile(path.resolve('start-server.ps1'), path.join(root, 'start-server.ps1'));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'start-server.ps1'), '-Port', String(port), '-NoBrowser'], { cwd: root, windowsHide: true });
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const url = `http://127.0.0.1:${port}/api/control/status`;
  const status = async () => {
    const start = performance.now();
    const response = await fetch(url, { headers: { 'x-evidence-control': '1' }, signal: AbortSignal.timeout(2500) });
    assert.equal(response.status, 200);
    await response.json();
    return Math.round(performance.now() - start);
  };
  let baseline;
  for (let i = 0; i < 30; i++) {
    try { baseline = await status(); break; } catch { await delay(150); }
  }
  assert.notEqual(baseline, undefined, `Server did not start: ${output}`);
  idle = net.connect(port, '127.0.0.1');
  await once(idle, 'connect');
  idle.on('error', () => {});
  await delay(250);
  let blocked = false;
  const start = performance.now();
  try { await status(); } catch (error) {
    assert.equal(error.name, 'TimeoutError');
    blocked = true;
  }
  const blockedElapsed = Math.round(performance.now() - start);
  idle.resetAndDestroy();
  idle = null;
  await delay(250);
  const recovered = await status();
  const result = { baselineMs: baseline, idleSocketBlocksControl: blocked, observationMs: blockedElapsed, afterDisconnectMs: recovered, readByteResetLogged: output.includes('ReadByte') && output.includes('[REQUEST ERROR]') };
  console.log(JSON.stringify(result, null, 2));
  assert.equal(blocked, true, '当前基线应复现空闲连接阻塞正常控制请求；修复后本诊断断言应翻转。');
} finally {
  idle?.destroy();
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
  await rm(root, { recursive: true, force: true });
}
