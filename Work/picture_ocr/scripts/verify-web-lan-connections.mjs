import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startWeb } from './lan-test-helpers.mjs';

const server = await startWeb({ shortBodyDeadlines: true });
const sockets = [];
async function connect(payload) {
  const socket = net.connect(server.port, '127.0.0.1');
  sockets.push(socket);
  socket.on('error', () => {});
  await once(socket, 'connect');
  if (payload) socket.write(payload);
  await delay(100);
  return socket;
}
async function responsive(label) {
  const start = performance.now();
  assert.equal((await server.control('status')).status, 200);
  assert.ok(performance.now() - start < 2000, label);
  console.log(`PASS ${label}`);
}
try {
  const idle = await connect();
  await responsive('idle connection does not block control');
  await connect('GET / HTTP/1.1\r\nHost: local\r\n');
  await responsive('partial header does not block control');
  await connect('POST /api/upload HTTP/1.1\r\nContent-Length: 10000\r\n\r\npartial');
  await responsive('partial body does not block control');
  idle.resetAndDestroy();
  await responsive('reset does not stop server');
  await writeFile(path.join(server.root, 'dist/large.bin'), Buffer.alloc(64 * 1024 * 1024));
  const slow = await connect('GET /large.bin HTTP/1.1\r\nHost: local\r\n\r\n');
  slow.pause();
  await responsive('client not reading response does not block control');
  for (const framing of ['Content-Length: -1', 'Content-Length: 4\r\nContent-Length: 5', 'Transfer-Encoding: chunked', 'Content-Length: 99999999999']) {
    const socket = await connect(`POST /api/upload HTTP/1.1\r\n${framing}\r\n\r\n`);
    socket.resume();
    await responsive('invalid framing isolated');
  }
  const drip = await connect('GET / HTTP/1.1\r\nX: ');
  drip.resume();
  const timer = setInterval(() => { if (!drip.destroyed) drip.write('a'); }, 200);
  try { await Promise.race([once(drip, 'close'), delay(6500).then(() => assert.fail('header total deadline was extended by slow bytes'))]); }
  finally { clearInterval(timer); }
  await responsive('header absolute deadline enforced');
  const bodyDrip = await connect('POST /api/upload HTTP/1.1\r\nContent-Length: 10000\r\n\r\n');
  bodyDrip.resume();
  const bodyTimer = setInterval(() => { if (!bodyDrip.destroyed) bodyDrip.write('a'); }, 100);
  try { await Promise.race([once(bodyDrip, 'close'), delay(2000).then(() => assert.fail('body total deadline extended by slow bytes'))]); }
  finally { clearInterval(bodyTimer); }
  await responsive('body absolute deadline enforced (isolated 1200ms budget)');
  let delivered = 0;
  slow.on('data', bytes => { delivered += bytes.length; });
  const closed = new Promise(resolve => slow.once('close', resolve));
  slow.resume();
  await Promise.race([closed, delay(2000).then(() => assert.fail('response did not terminate'))]);
  assert.ok(delivered >= 64 * 1024 * 1024 || /phase=response.*timeout=True/.test(server.output()), 'send either completes into OS buffers or ends at the response deadline');
  console.log(delivered >= 64 * 1024 * 1024 ? 'PASS slow response completed into OS buffers without blocking control' : 'PASS blocked response deadline enforced');
  for (const socket of sockets) socket.destroy();
  await delay(100);
  const pool = [];
  for (let index = 0; index < 32; index++) pool.push(await connect());
  const overflow = await connect();
  assert.equal(overflow.destroyed, true, 'connection pool refuses a 33rd client');
  pool[0].destroy(); await delay(100);
  await responsive('bounded connection pool releases capacity');
  for (const socket of sockets) socket.destroy();
  assert.ok(!server.output().includes('[SERVER ERROR]'), server.output());
} finally { for (const socket of sockets) socket.destroy(); await server.stop(); }
