import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// 真实服务 + 真实 IDB。CDP 冻结是受控生命周期实验，不等于 Windows/手机 OS 锁屏。
export async function runLifecycleCases({ computer, phone, until, click, pass, url, platform }) {
  const failures = [];
  const freezePhone = async () => {
    await phone.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await phone.send('Page.setWebLifecycleState', { state: 'frozen' });
  };
  const restorePhone = async () => {
    await phone.send('Page.setWebLifecycleState', { state: 'active' });
    // Headless 解冻后仍报告 hidden；显式模拟前台并验证浏览器状态。
    await phone.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    assert.equal(await phone.evaluate('document.visibilityState'), 'visible');
  };
  await phone.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const check = async (label, run) => {
    try { await run(); pass(label); }
    catch (error) { failures.push(`${label}: ${error.message}`); console.error(`FAIL ${platform}: ${failures.at(-1)}`, await phone.evaluate('({ visibility: document.visibilityState, phase: document.querySelector("#upload-recovery-title")?.textContent, statusReads: window.statusReads, message: document.body.innerText.slice(-800) })')); }
  };
  await check('工作台启动读取真实组名', async () => {
    assert.equal(await phone.evaluate('document.querySelector("h1").textContent'), '公共资源中心公共服务与产权交易综合管理项目');
  });
  await check('采集期间通过项目信息改名，手机更新且范围不变', async () => {
    await computer.evaluate(`document.querySelector('[aria-label="收起手机局域网采集对话框"]').click()`);
    await click(computer, '项目信息');
    await computer.evaluate(`(() => {
      const inputs = document.querySelectorAll('[role="dialog"] input');
      const name = inputs[1];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, '锁屏回归项目');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click(computer, '保存');
    await until(phone, 'document.querySelector("h1").textContent === "锁屏回归项目"', '组名更新');
    const session = await fetch(new URL('/api/session' + new URL(url).hash.replace('#/lan/', '?token='), url)).then(r => r.json());
    assert.deepEqual(session.systems.map(s => s.projectId).sort(), ['g1', 'g2']);
  });
  await check('列表修改项目名后同一采集会话同步更新', async () => {
    await click(computer, '返回项目列表');
    await until(computer, 'document.querySelector("[data-group-id=multi] summary")', '列表加载');
    await delay(800); // 等工作台卸载触发的 400ms 重建结束，避免它碰巧覆盖列表改名。
    await computer.evaluate('document.querySelector("[data-group-id=multi] summary").click()');
    await click(computer, '编辑项目组');
    await computer.evaluate(`(() => {
      const name = document.querySelectorAll('[role="dialog"] input')[1];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, '列表改名回归项目');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click(computer, '保存');
    await until(phone, 'document.querySelector("h1").textContent === "列表改名回归项目"', '列表改名后手机更新');
    const session = await fetch(new URL('/api/session' + new URL(url).hash.replace('#/lan/', '?token='), url)).then(r => r.json());
    assert.deepEqual(session.systems.map(s => s.projectId).sort(), ['g1', 'g2']);
  });
  await check('无网页相机 API 时一次点击直接打开系统相机', async () => {
    await phone.evaluate(`(() => {
      window.cameraClicks = 0;
      window.originalInputClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () { if (this.type === 'file') { window.cameraClicks++; window.lastCapture = this.getAttribute('capture'); } else window.originalInputClick.call(this); };
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
      document.querySelectorAll('#capture-source-mode-title + div button')[1].click();
    })()`);
    await click(phone, '拍照 / 选择图片');
    await click(phone, '拍照');
    assert.equal(await phone.evaluate('window.cameraClicks'), 1);
    assert.equal(await phone.evaluate('window.lastCapture'), 'environment');
    assert.ok(await phone.evaluate('!document.querySelector("[aria-labelledby=capture-source-title]") && !document.querySelector("[aria-labelledby=camera-preview-title]")'));
  });
  await check('非安全上下文直达系统相机，取消后可重新进入', async () => {
    await phone.evaluate(`(() => {
      window.cameraCalls = 0;
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { window.cameraCalls++; throw new DOMException('denied', 'NotAllowedError'); } } });
    })()`);
    await click(phone, '拍照 / 选择图片');
    await click(phone, '取消');
    await click(phone, '拍照 / 选择图片');
    await click(phone, '拍照');
    assert.equal(await phone.evaluate('window.cameraCalls'), 0);
    assert.equal(await phone.evaluate('window.cameraClicks'), 2);
    assert.equal(await phone.evaluate('window.uploadIds.length'), 0);
  });
  await check('安全上下文权限拒绝保留人工回退；相册取消不上传', async () => {
    await phone.evaluate(`void Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })`);
    await click(phone, '拍照 / 选择图片');
    await click(phone, '拍照');
    await until(phone, 'qa.button("使用系统相机回退")', '权限拒绝后的回退入口');
    assert.equal(await phone.evaluate('window.cameraCalls'), 1);
    assert.equal(await phone.evaluate('window.cameraClicks'), 2);
    await click(phone, '使用系统相机回退');
    assert.equal(await phone.evaluate('window.cameraClicks'), 3);
    await click(phone, '拍照 / 选择图片');
    await click(phone, '从相册选择');
    assert.equal(await phone.evaluate('window.lastCapture'), null);
    assert.equal(await phone.evaluate('window.uploadIds.length'), 0);
  });
  await check('安全上下文相机预览取消释放媒体流', async () => {
    await phone.evaluate(`(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
        canvas.getContext('2d').fillRect(0, 0, 32, 24);
        window.previewStream = canvas.captureStream(1);
        return window.previewStream;
      };
    })()`);
    await click(phone, '拍照 / 选择图片');
    await click(phone, '拍照');
    await until(phone, 'qa.button("确认拍照") && !qa.button("确认拍照").disabled', '相机预览就绪');
    await click(phone, '取消');
    assert.equal(await phone.evaluate('window.previewStream.getTracks().every(track => track.readyState === "ended")'), true);
    assert.equal(await phone.evaluate('window.uploadIds.length'), 0);
  });
  await phone.evaluate(`(() => {
    HTMLInputElement.prototype.click = window.originalInputClick;
    document.querySelectorAll('#capture-source-mode-title + div button')[0].click();
    window.statusReads = 0;
    const nativeFetch = window.fetch;
    window.fetch = (input, options) => {
      if (String(input).includes('/api/upload-status')) {
        window.statusReads++;
        if (window.statusOffline) return Promise.reject(new TypeError('Failed to fetch'));
      }
      return nativeFetch(input, options);
    };
  })()`);
  await check('手机网络中断后恢复自动核对，无重复 POST 或入库', async () => {
    await phone.evaluate('window.statusOffline = true; window.lanFault = "lost"; qa.sendFile()');
    await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '保留原图');
    await until(computer, 'qa.images().then(v => v.count === 1)', '电脑已存');
    await freezePhone();
    await delay(400);
    await restorePhone();
    await phone.evaluate('window.statusOffline = false; window.lanFault = ""; window.dispatchEvent(new Event("online"))');
    await until(phone, '!document.querySelector("a[download]")', '恢复后自动核对');
    assert.equal(await phone.evaluate('window.uploadIds.length'), 1);
    assert.equal((await computer.evaluate('qa.images()')).count, 1);
  });
  // 失败时清理当前图，以便继续证明另外的生命周期路径。
  if (await phone.evaluate('!!document.querySelector("a[download]")')) {
    await click(phone, '重新核对并重试');
    await until(phone, '!document.querySelector("a[download]")', '清理已确认图片');
  }
  await check('电脑与手机同时冻结，恢复后原请求保存一次', async () => {
    await computer.send('Page.setWebLifecycleState', { state: 'frozen' });
    await phone.evaluate('qa.sendFile()');
    await until(phone, 'window.uploadIds.length === 2', '第二张发起上传');
    await freezePhone();
    await delay(3600); // 超过该页面缩短后的等待预算，生产预算未调整。
    await computer.send('Page.setWebLifecycleState', { state: 'active' });
    await restorePhone();
    await phone.evaluate('document.dispatchEvent(new Event("visibilitychange"))');
    await until(computer, 'qa.images().then(v => v.count === 2)', '电脑恢复后入库');
    await until(phone, '!document.querySelector("a[download]")', '两端恢复自动核对');
    assert.equal(await phone.evaluate('window.uploadIds.length'), 2);
    const images = await computer.evaluate('qa.images()');
    assert.equal(images.ids.length, 2);
    assert.equal(new Set(images.ids).size, 2);
  });
  await check('仅电脑冻结、手机保持前台，电脑恢复后自动确认', async () => {
    await computer.send('Page.setWebLifecycleState', { state: 'frozen' });
    try {
      await phone.evaluate('qa.sendFile()');
      await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '电脑暂停期间保留原图');
    } finally {
      await computer.send('Page.setWebLifecycleState', { state: 'active' });
    }
    await until(computer, 'qa.images().then(v => v.count === 3)', '电脑恢复保存');
    await until(phone, '!document.querySelector("a[download]")', '手机保持前台自动确认');
    assert.equal(await phone.evaluate('window.uploadIds.length'), 3);
    assert.equal((await computer.evaluate('qa.images()')).ids.length, 3);
  });
  await check('两端暂停后手机先恢复，电脑稍后恢复仍只保存一次', async () => {
    await computer.send('Page.setWebLifecycleState', { state: 'frozen' });
    try {
      await phone.evaluate('qa.sendFile()');
      await until(phone, 'window.uploadIds.length === 4', '第四次上传开始');
      await freezePhone();
      await delay(3600);
      await restorePhone();
      await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '电脑仍暂停时保留原图');
    } finally {
      await computer.send('Page.setWebLifecycleState', { state: 'active' });
      await restorePhone();
    }
    await until(computer, 'qa.images().then(v => v.count === 4)', '电脑恢复后的第四张图片');
    await until(phone, '!document.querySelector("a[download]")', '不同恢复顺序自动确认');
    assert.equal(await phone.evaluate('window.uploadIds.length'), 4);
    assert.equal((await computer.evaluate('qa.images()')).ids.length, 4);
  });
  if (failures.length) throw new Error(failures.join('\n'));
}
