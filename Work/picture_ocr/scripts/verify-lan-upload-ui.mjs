import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { startWeb, freePort } from './lan-test-helpers.mjs';
import { connectBrowser } from './browser-test-client.mjs';
import { runLifecycleCases } from './lan-lifecycle-ui-cases.mjs';
const lifecycle = process.argv.includes('--lifecycle');
const require = createRequire(import.meta.url);
const output = path.resolve('.trellis/.runtime/lan-upload-qa'); await mkdir(output, { recursive: true });
const bundle = (await build({ entryPoints: ['scripts/lan-browser-cases.mjs'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'qa' })).outputFiles[0].text;
const report = [];
const until = async (client, expression, label) => {
  if (!lifecycle) return client.evaluate(`qa.until(() => (${expression}), ${JSON.stringify(label)})`);
  for (let n = 0; n < 80; n++) {
    if (await client.evaluate(`(async () => Boolean(await (${expression})))()`)) return;
    await delay(100);
  }
  throw new Error(`等待超时：${label}`);
};
const click = (client, text) => client.evaluate(`(() => { const button = qa.button(${JSON.stringify(text)}); if (!button || button.disabled) throw new Error('按钮不可用'); button.click(); })()`);
for (const platform of (process.argv.includes('--web-only') ? ['web'] : process.argv.includes('--desktop-only') ? ['desktop'] : ['web', 'desktop'])) {
  let host, computer, phone;
  const children = [], profiles = [];
  const pass = label => { report.push({ platform, label }); console.log(`PASS ${platform}: ${label}`); };
  const launch = async (desktop, url = 'about:blank') => {
    const profile = await mkdtemp(path.join(tmpdir(), 'picture-ocr-lan-browser-')); profiles.push(profile);
    const port = await freePort();
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile, LAN_TEST_BACKGROUND: lifecycle ? '1' : '' }; delete env.ELECTRON_RUN_AS_NODE;
    const child = desktop
      ? spawn(require('electron'), ['scripts/project-list-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' })
      : spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', ...(lifecycle ? [] : ['--disable-background-timer-throttling']), `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, url], { stdio: 'ignore' });
    children.push(child);
    return connectBrowser(port, target => target.type === 'page');
  };
  try {
    if (platform === 'web') host = await startWeb({ built: true });
    computer = await launch(platform === 'desktop', host?.base);
    await computer.send('Page.enable');
    await delay(1000);
    await computer.evaluate(bundle);
    await until(computer, 'document.querySelector("#project-list-title")', '电脑启动');
    await computer.evaluate('qa.seed()');
    await computer.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle });
    await computer.send('Page.reload', { ignoreCache: true }); await delay(700);
    const url = await computer.evaluate(`qa.startLan(${JSON.stringify(lifecycle ? 'workbench' : 'group')})`); assert.ok(url);
    phone = await launch(false);
    await phone.send('Page.enable');
    await phone.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle + '\nqa.mobileInstrument();' });
    await phone.send('Page.navigate', { url }); await delay(600);
    await until(phone, 'document.querySelector("input[type=file]")', '手机采集启动');
    if (lifecycle) {
      await runLifecycleCases({ computer, phone, until, click, pass, url, platform });
      continue;
    }
    await phone.evaluate('window.lanFault = "lost"; qa.sendFile()');
    await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '丢回执后恢复');
    await until(computer, 'qa.images().then(value => value.count === 1)', '真实图片入库');
    assert.ok(await phone.evaluate('document.querySelector("a[download]").href.startsWith("blob:")'));
    assert.ok(await phone.evaluate('qa.button("拍照 / 选择图片").disabled'));
    // 新选图不会覆盖保留的身份；切换系统也不能改变原请求目标。
    await phone.evaluate('qa.sendFile()');
    await click(phone, '公共资源中心跨部门协同办公系统');
    const originalId = await phone.evaluate('window.uploadIds[0]');
    await phone.evaluate('window.lanFault = ""');
    await click(phone, '重新核对并重试');
    await until(phone, '!document.querySelector("a[download]")', '核对已保存');
    assert.deepEqual(await computer.evaluate('qa.images()'), { count: 1, ids: [`lan-${originalId}`] });
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 0);
    pass('真实入库后上传响应丢失：保留原图、固定目标核对、单条引用和字节');

    if (platform === 'web') await computer.evaluate('qa.loseConfirmation()');
    await phone.evaluate('window.lanFault = "hang"; qa.sendFile()');
    await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '上传挂起超时');
    for (const width of [375, 768, 1440]) {
      await phone.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      assert.ok(await phone.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      assert.ok(await phone.evaluate('document.querySelector("#upload-recovery-title").getAttribute("role") === "status"'));
      assert.ok(await phone.evaluate('qa.button("重新核对并重试").getBoundingClientRect().height >= 44'));
      const screenshot = await phone.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `${platform}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    await phone.evaluate('window.lanFault = ""; qa.button("重新核对并重试").focus()');
    await phone.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await phone.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(phone, '!document.querySelector("a[download]")', '键盘恢复上传');
    const uploads = await phone.evaluate('window.uploadIds'); assert.equal(uploads.at(-1), uploads.at(-2));
    assert.deepEqual(await computer.evaluate('qa.images("g2")'), { count: 1, ids: [`lan-${uploads.at(-1)}`] });
    if (platform === 'web') await until(computer, 'window.lostConfirmations >= 2', '丢失电脑回执后的实际重试');
    pass(platform === 'web' ? '网络挂起有界恢复、同编号重传、375/768/1440px、真实 Enter、电脑确认响应丢失' : '网络挂起有界恢复、同编号重传、375/768/1440px、真实 Enter');

    await computer.evaluate('qa.failWrites(true)');
    await phone.evaluate('qa.sendFile()');
    await until(phone, 'document.querySelector("#upload-recovery-title")?.textContent === "本次同步未完成"', '真实存储失败');
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 1);
    await computer.evaluate('qa.failWrites(false)');
    await click(phone, '重新核对并重试');
    await until(phone, '!document.querySelector("a[download]")', '存储恢复人工重试');
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 2);
    pass('实际 IDB 写路径故障不报成功，原图保留，恢复后仅增加一张');

    await computer.evaluate('qa.holdCompletion()');
    await phone.evaluate('qa.sendFile()');
    await until(computer, 'typeof window.releaseCompletion === "function"', '真实事务提交事件被延迟');
    await until(phone, 'document.querySelector("#upload-recovery-title")?.textContent === "尚未确认保存结果"', '迟到完成不误报失败');
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 3);
    await computer.evaluate('window.releaseCompletion()');
    await click(phone, '重新核对并重试');
    await until(phone, '!document.querySelector("a[download]")', '迟到提交核对成功');
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 3);
    pass('真实 IDB 已提交但完成通知延迟：尚未确认、迟到成功、不重复入库');

    await phone.evaluate('qa.hangImageDecode(); qa.sendFile()');
    await until(phone, '!document.querySelector("a[download]") && typeof window.finishDecode === "function"', '解码超时回退原图');
    assert.equal((await computer.evaluate('qa.images("g2")')).count, 4);
    await phone.evaluate('window.finishDecode()');
    await until(phone, 'window.lateBitmapClosed === true', '迟到位图释放');
    pass('真实压缩入口解码挂起：有界回退原图、迟到位图释放');

    await phone.evaluate('window.lanFault = "late"; qa.sendFile()');
    await until(phone, 'qa.button("重新核对并重试") && !qa.button("重新核对并重试").disabled', '停止前保留图片');
    await computer.evaluate('qa.stopLan()');
    await phone.evaluate('window.lanFault = ""');
    await click(phone, '重新核对并重试');
    await until(phone, 'qa.button("放弃当前照片") && !qa.button("放弃当前照片").disabled', '会话失效恢复');
    assert.ok(await phone.evaluate('!!document.querySelector("a[download]")'));
    pass('会话结束保留原图并恢复可操作状态');
    const originalUrl = await phone.evaluate('document.querySelector("a[download]").href');
    await phone.evaluate('location.hash = "#/lan/invalid-new-session"');
    await until(phone, 'document.querySelector("#upload-recovery-title")?.textContent === "原采集会话已结束"', 'token 切换隔离');
    await phone.evaluate('window.finishUpload()');
    await delay(200);
    assert.equal(await phone.evaluate('document.querySelector("a[download]").href'), originalUrl);
    assert.ok(await phone.evaluate('!document.body.innerText.includes("图片已同步到电脑。")'));
    await phone.evaluate('window.revokedUrls = []; const original = URL.revokeObjectURL; URL.revokeObjectURL = url => { window.revokedUrls.push(url); original(url); }; location.hash = "#/"');
    await until(phone, '!document.querySelector("a[download]")', '离开采集页面');
    assert.ok((await phone.evaluate('window.revokedUrls')).includes(originalUrl));
    pass('token 切换保留旧图但禁止跨会话重传，迟到成功不污染，卸载释放原图 URL');
  } catch (error) {
    if (phone) {
      await writeFile(path.join(output, `${platform}-failure.txt`), await phone.evaluate('document.body.innerText').catch(() => 'browser disconnected'));
    }
    throw error;
  } finally {
    computer?.close(); phone?.close();
    for (const child of children) { if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } }
    await host?.stop();
    for (const profile of profiles) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
await writeFile(path.join(output, lifecycle ? 'lifecycle-report.json' : 'report.json'), JSON.stringify(report, null, 2));
