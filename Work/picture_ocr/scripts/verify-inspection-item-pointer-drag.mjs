import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const chromeExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const vitePort = 4300 + (process.pid % 1000) * 2;
const debuggingPort = vitePort + 1;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-ocr-pointer-drag-'));

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, description) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The server and browser are expected to be unavailable while starting.
    }
    await wait(100);
  }
  throw new Error(`等待超时：${description}`);
}

async function createDebugger() {
  const pages = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
  const page = pages.find((candidate) => candidate.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl, '未找到 Chrome 调试页面');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const resolver = pending.get(message.id);
    if (!resolver) return;
    pending.delete(message.id);
    if (message.error) resolver.reject(new Error(message.error.message));
    else resolver.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    async send(method, params = {}) {
      const id = nextId++;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(debuggerClient, expression) {
  const result = await debuggerClient.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function getSortingCards(debuggerClient) {
  return evaluate(debuggerClient, `Array.from(document.querySelectorAll('[data-item-id]')).map((card) => {
    const rect = card.getBoundingClientRect();
    const handle = card.querySelector('button');
    const handleRect = handle?.getBoundingClientRect();
    return {
      id: card.dataset.itemId,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      centerX: (handleRect.left + handleRect.right) / 2,
      centerY: (handleRect.top + handleRect.bottom) / 2,
      targetX: rect.left + rect.width / 2,
      targetBeforeY: rect.top + Math.min(8, rect.height / 4),
    };
  })`);
}

async function waitForStableSortingCards(debuggerClient) {
  let previousSnapshot = null;
  await waitFor(async () => {
    const cards = await getSortingCards(debuggerClient);
    const first = cards[0];
    const second = cards[1];
    if (!first || !second) return false;
    const snapshot = JSON.stringify(cards.slice(0, 2));
    const handlesAlign = Math.abs(first.centerX - second.centerX) < 2;
    const cardsAreSized = first.right - first.left > 500 && first.bottom - first.top >= 44;
    const isStable = snapshot === previousSnapshot;
    previousSnapshot = snapshot;
    return handlesAlign && cardsAreSized && isStable;
  }, '排序卡布局稳定');
  return getSortingCards(debuggerClient);
}

async function waitForOrder(debuggerClient, expectedOrder) {
  try {
    await waitFor(async () => {
      const actualOrder = await evaluate(debuggerClient, "Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId)");
      return JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
    }, `检查项顺序更新为 ${expectedOrder.join(', ')}`);
  } catch (error) {
    const snapshot = await evaluate(debuggerClient, `({
      href: location.href,
      order: Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId),
      status: Array.from(document.querySelectorAll('[role="status"]')).map((element) => element.textContent?.trim()),
      contentScroll: (() => { const main = document.querySelector('main'); return main ? { top: main.scrollTop, height: main.clientHeight, scrollHeight: main.scrollHeight } : null; })(),
      bodyText: document.body.textContent?.trim().slice(0, 200),
      pointerEvents: window.__pointerDragRegressionEvents ?? [],
      touchActions: (() => {
        const handle = document.querySelector('[data-item-id] button');
        const actions = [];
        for (let element = handle; element instanceof HTMLElement && actions.length < 5; element = element.parentElement) {
          actions.push({ tag: element.tagName, className: element.className, touchAction: getComputedStyle(element).touchAction });
        }
        return actions;
      })(),
      sourceCount: document.querySelectorAll('.opacity-70').length,
      targetCount: document.querySelectorAll('.ring-2').length,
    })`);
    throw new Error(`${error.message}；拖拽后页面快照：${JSON.stringify(snapshot)}`);
  }
}

async function enterSortingMode(debuggerClient) {
  const foundButton = await evaluate(debuggerClient, `(() => {
    const element = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '调整顺序');
    element?.scrollIntoView({ block: 'center' });
    return !!element;
  })()`);
  assert.equal(foundButton, true, '未找到“调整顺序”按钮');
  await wait(100);
  const button = await evaluate(debuggerClient, `(() => {
    const element = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '调整顺序');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  })()`);
  assert.ok(button, '未找到“调整顺序”按钮');
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: button.x, y: button.y, button: 'left', buttons: 1, clickCount: 1,
  });
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: button.x, y: button.y, button: 'left', buttons: 0, clickCount: 1,
  });
  try {
    await waitFor(
      () => evaluate(debuggerClient, "document.body.textContent?.includes('完成排序') && document.querySelectorAll('[data-item-id]').length >= 2"),
      '排序模式渲染完成'
    );
  } catch (error) {
    const snapshot = await evaluate(debuggerClient, `({
      button: { x: ${button.x}, y: ${button.y} },
      viewport: { width: window.innerWidth, height: window.innerHeight, visualWidth: window.visualViewport?.width, visualHeight: window.visualViewport?.height },
      hit: (() => { const element = document.elementFromPoint(${button.x}, ${button.y}); return element ? { tag: element.tagName, text: element.textContent?.trim().slice(0, 30) } : null; })(),
      events: window.__pointerDragRegressionEvents.map(({ type, pointerType, button: eventButton, target }) => ({ type, pointerType, button: eventButton, target: target?.slice(0, 30) })),
      cards: document.querySelectorAll('[data-item-id]').length,
    })`);
    throw new Error(`${error.message}；页面快照：${JSON.stringify(snapshot)}`);
  }
  await evaluate(debuggerClient, `(() => {
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) main.scrollTop = 0;
  })()`);
  await wait(100);
}

function getDragPoints(source, target) {
  return Array.from({ length: 12 }, (_, index) => {
    const progress = (index + 1) / 12;
    return {
      x: source.centerX + (target.targetX - source.centerX) * progress,
      y: source.centerY + (target.targetBeforeY - source.centerY) * progress,
    };
  });
}

async function startMouseDrag(debuggerClient, source) {
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: source.centerX, y: source.centerY, button: 'left', buttons: 1, clickCount: 1,
  });
}

async function moveMouseDrag(debuggerClient, source, target) {
  for (const point of getDragPoints(source, target)) {
    await debuggerClient.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1,
    });
    await wait(8);
  }
}

async function releaseMouseDrag(debuggerClient, target) {
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: target.targetX, y: target.targetBeforeY, button: 'left', buttons: 0, clickCount: 1,
  });
}

async function moveMouseDragToPoint(debuggerClient, point) {
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1,
  });
}

async function releaseMouseDragAtPoint(debuggerClient, point) {
  await debuggerClient.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1,
  });
}

async function getMainScrollState(debuggerClient) {
  return evaluate(debuggerClient, `(() => {
    const main = document.querySelector('main');
    if (!(main instanceof HTMLElement)) return null;
    const rect = main.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      scrollTop: main.scrollTop,
      clientHeight: main.clientHeight,
      scrollHeight: main.scrollHeight,
    };
  })()`);
}

async function waitForContinuousMainScroll(debuggerClient, scrollTop, description) {
  await waitFor(async () => (await getMainScrollState(debuggerClient))?.scrollTop > scrollTop + 4, `${description}（首次滚动）`);
  const afterFirstScroll = (await getMainScrollState(debuggerClient)).scrollTop;
  await waitFor(async () => (await getMainScrollState(debuggerClient))?.scrollTop > afterFirstScroll + 4, `${description}（持续滚动）`);
}

async function assertMainScrollStopped(debuggerClient, description) {
  const beforeWait = await getMainScrollState(debuggerClient);
  assert.ok(beforeWait, '未找到检查项滚动容器');
  await wait(180);
  const afterWait = await getMainScrollState(debuggerClient);
  assert.equal(afterWait?.scrollTop, beforeWait.scrollTop, description);
}

async function dragWithMouse(debuggerClient, source, target) {
  await startMouseDrag(debuggerClient, source);
  await moveMouseDrag(debuggerClient, source, target);
  await releaseMouseDrag(debuggerClient, target);
}

async function installPointerEventLog(debuggerClient) {
  await evaluate(debuggerClient, `window.__pointerDragRegressionEvents = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
      window.addEventListener(type, (event) => window.__pointerDragRegressionEvents.push({
        type,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
        target: event.target instanceof Element ? event.target.closest('button, [data-item-id]')?.getAttribute('data-item-id') ?? event.target.tagName : null,
      }), { capture: true });
    }`);
}

async function getPointerEventLog(debuggerClient) {
  return evaluate(debuggerClient, 'window.__pointerDragRegressionEvents ?? []');
}

async function startTouchDrag(debuggerClient, source) {
  await debuggerClient.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: source.centerX, y: source.centerY, id: 1 }],
  });
}

async function moveTouchDrag(debuggerClient, source, target) {
  for (const point of getDragPoints(source, target)) {
    await debuggerClient.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    await wait(8);
  }
}

async function moveTouchDragToPoint(debuggerClient, source, point) {
  await moveTouchDrag(debuggerClient, source, { targetX: point.x, targetBeforeY: point.y });
}

async function dragWithTouch(debuggerClient, source, target) {
  await startTouchDrag(debuggerClient, source);
  await moveTouchDrag(debuggerClient, source, target);
  await debuggerClient.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const serverMode = process.env.POINTER_DRAG_SERVER_MODE === 'dev' ? 'dev' : 'preview';
const vite = spawn(process.execPath, [
  path.join(projectRoot, 'node_modules/vite/bin/vite.js'),
  ...(serverMode === 'preview' ? ['preview'] : []),
  '--host', '127.0.0.1', '--port', String(vitePort),
], {
  cwd: projectRoot,
  stdio: 'ignore',
});
const chrome = spawn(chromeExecutable, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${path.join(temporaryDirectory, 'chrome-profile')}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--window-size=1440,1800',
  'about:blank',
], { stdio: 'ignore' });

let debuggerClient;
try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}`)).ok, serverMode === 'preview' ? 'Vite 生产预览服务器' : 'Vite 开发服务器');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).ok, 'Chrome DevTools Protocol');
  debuggerClient = await createDebugger();
  await debuggerClient.send('Page.enable');
  await debuggerClient.send('Runtime.enable');
  await debuggerClient.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 640,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await debuggerClient.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/#/project/pointer-drag-regression` });
  await waitFor(
    () => evaluate(debuggerClient, "document.body.textContent?.includes('调整顺序')"),
    '工作台加载完成'
  );
  if (serverMode === 'preview') {
    await waitFor(
      async () => evaluate(debuggerClient, `(() => {
        const bundle = document.querySelector('script[type="module"]')?.getAttribute('src');
        return !!navigator.serviceWorker.controller
          && typeof bundle === 'string'
          && caches.keys().then((keys) => keys.some((key) => key.startsWith('picture-ocr-static-')));
      })()`),
      '生产预览 Service Worker 控制当前页面'
    );
    const currentBundleIsPrecached = await evaluate(debuggerClient, `(async () => {
      const bundle = document.querySelector('script[type="module"]')?.getAttribute('src');
      if (!bundle) return false;
      const url = new URL(bundle, location.href).href;
      const cacheNames = await caches.keys();
      const matches = await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).match(url)));
      return matches.some(Boolean);
    })()`);
    assert.equal(currentBundleIsPrecached, true, '生产预览 Service Worker 必须预缓存当前入口 bundle');
  }

  await enterSortingMode(debuggerClient);
  const handleTouchAction = await evaluate(debuggerClient, "getComputedStyle(document.querySelector('[data-item-id] button')).touchAction");
  assert.equal(handleTouchAction, 'none', '排序手柄必须以 touch-action: none 保留触摸 Pointer Events');
  let initialCards = await waitForStableSortingCards(debuggerClient);
  assert.ok(initialCards.length >= 2, '回归夹具至少需要两个检查项');

  const initialMainScroll = await getMainScrollState(debuggerClient);
  assert.ok(initialMainScroll && initialMainScroll.scrollHeight > initialMainScroll.clientHeight, '回归夹具必须可滚动');
  const bottomEdgePoint = {
    x: (initialMainScroll.left + initialMainScroll.right) / 2,
    y: initialMainScroll.bottom - 12,
  };
  const safePoint = {
    x: bottomEdgePoint.x,
    y: initialMainScroll.top + Math.min(120, initialMainScroll.clientHeight / 3),
  };

  await startMouseDrag(debuggerClient, initialCards[0]);
  await moveMouseDragToPoint(debuggerClient, bottomEdgePoint);
  await waitForContinuousMainScroll(debuggerClient, initialMainScroll.scrollTop, '指针位于底部边缘时必须自动滚动');
  await moveMouseDragToPoint(debuggerClient, safePoint);
  await assertMainScrollStopped(debuggerClient, '指针移离滚动边缘后必须立即停止自动滚动');

  const scrollBeforeRelease = (await getMainScrollState(debuggerClient)).scrollTop;
  await moveMouseDragToPoint(debuggerClient, bottomEdgePoint);
  await waitForContinuousMainScroll(debuggerClient, scrollBeforeRelease, '指针重新靠近底部边缘时必须恢复自动滚动');
  await releaseMouseDragAtPoint(debuggerClient, bottomEdgePoint);
  await assertMainScrollStopped(debuggerClient, 'PointerUp 后必须立即停止自动滚动');

  await evaluate(debuggerClient, `(() => {
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) main.scrollTop = 0;
  })()`);
  await wait(100);
  initialCards = await waitForStableSortingCards(debuggerClient);

  await startMouseDrag(debuggerClient, initialCards[0]);
  await moveMouseDrag(debuggerClient, initialCards[0], initialCards[0]);
  assert.equal(
    await evaluate(debuggerClient, "document.querySelector('[data-drag-overlay]') !== null"),
    true,
    '指针仍位于拖动源项时也必须显示跟随指针的悬浮副本'
  );
  assert.deepEqual(
    await evaluate(debuggerClient, "Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId)"),
    initialCards.map((card) => card.id),
    '指针仍位于源项时不得产生虚假的预览换位'
  );
  await releaseMouseDrag(debuggerClient, initialCards[0]);

  const mouseExpectedOrder = [initialCards[1].id, initialCards[0].id, ...initialCards.slice(2).map((card) => card.id)];
  await startMouseDrag(debuggerClient, initialCards[1]);
  const cardsDuringMouseDrag = await getSortingCards(debuggerClient);
  await moveMouseDrag(debuggerClient, cardsDuringMouseDrag[1], cardsDuringMouseDrag[0]);
  await waitForOrder(debuggerClient, mouseExpectedOrder);
  assert.equal(
    await evaluate(debuggerClient, "document.querySelector('[data-drag-overlay]') !== null"),
    true,
    '拖动尚未松开时必须渲染跟随指针的悬浮副本'
  );
  await releaseMouseDrag(debuggerClient, initialCards[0]);
  await waitForOrder(debuggerClient, mouseExpectedOrder);

  const cardsAfterMouse = await waitForStableSortingCards(debuggerClient);
  await installPointerEventLog(debuggerClient);
  const touchExpectedOrder = [cardsAfterMouse[1].id, cardsAfterMouse[0].id, ...cardsAfterMouse.slice(2).map((card) => card.id)];
  await dragWithTouch(debuggerClient, cardsAfterMouse[1], cardsAfterMouse[0]);
  await waitForOrder(debuggerClient, touchExpectedOrder);
  const touchEvents = await getPointerEventLog(debuggerClient);
  assert.ok(touchEvents.some((event) => event.type === 'pointerup'), '触摸提交路径必须收到 pointerup');
  assert.ok(touchEvents.some((event) => event.type === 'lostpointercapture'), '触摸提交后浏览器应释放 Pointer Capture');

  const cardsBeforeCancel = await waitForStableSortingCards(debuggerClient);
  const cancelStartOrder = cardsBeforeCancel.map((card) => card.id);
  await installPointerEventLog(debuggerClient);
  await startTouchDrag(debuggerClient, cardsBeforeCancel[1]);
  await moveTouchDrag(debuggerClient, cardsBeforeCancel[1], cardsBeforeCancel[0]);
  assert.deepEqual(
    await evaluate(debuggerClient, "Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId)"),
    [cardsBeforeCancel[1].id, cardsBeforeCancel[0].id, ...cardsBeforeCancel.slice(2).map((card) => card.id)],
    '触摸拖动取消前必须实时呈现预览顺序'
  );
  await debuggerClient.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await wait(100);
  assert.deepEqual(
    await evaluate(debuggerClient, "Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId)"),
    cancelStartOrder,
    'Pointer 取消应明确放弃排序，而不是写入半成品顺序'
  );
  const cancelEvents = await getPointerEventLog(debuggerClient);
  assert.ok(cancelEvents.some((event) => event.type === 'pointercancel'), '触摸取消必须传递为 pointercancel');
  assert.equal(cancelEvents.some((event) => event.type === 'pointerup'), false, '触摸取消不应伪装为 pointerup');

  await evaluate(debuggerClient, `(() => {
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) main.scrollTop = 0;
  })()`);
  await wait(100);
  const cardsBeforeEdgeCancel = await waitForStableSortingCards(debuggerClient);
  const mainBeforeEdgeCancel = await getMainScrollState(debuggerClient);
  assert.ok(mainBeforeEdgeCancel, '未找到检查项滚动容器');
  const edgeCancelStartOrder = cardsBeforeEdgeCancel.map((card) => card.id);
  await startTouchDrag(debuggerClient, cardsBeforeEdgeCancel[0]);
  await moveTouchDragToPoint(debuggerClient, cardsBeforeEdgeCancel[0], {
    x: (mainBeforeEdgeCancel.left + mainBeforeEdgeCancel.right) / 2,
    y: mainBeforeEdgeCancel.bottom - 12,
  });
  await waitForContinuousMainScroll(debuggerClient, mainBeforeEdgeCancel.scrollTop, '触摸指针位于底部边缘时必须自动滚动');
  await debuggerClient.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await assertMainScrollStopped(debuggerClient, 'PointerCancel 后必须立即停止自动滚动');
  assert.deepEqual(
    await evaluate(debuggerClient, "Array.from(document.querySelectorAll('[data-item-id]')).map((card) => card.dataset.itemId)"),
    edgeCancelStartOrder,
    '边缘自动滚动后的 PointerCancel 仍必须放弃实时预览顺序'
  );

  console.log('检查项 Pointer 拖拽浏览器回归通过：实时预览、鼠标/触摸提交、取消还原与边缘自动滚动均符合预期。');
} finally {
  debuggerClient?.close();
  chrome.kill();
  vite.kill();
  await Promise.all([
    new Promise((resolve) => chrome.once('exit', resolve)),
    new Promise((resolve) => vite.once('exit', resolve)),
  ]);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
