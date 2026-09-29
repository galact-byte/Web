// storage-reminder：隔离 Chrome 与 Electron 各跑一轮。
import { runBrowserCases } from './browser-cases-harness.mjs';
await runBrowserCases('scripts/storage-reminder-cases.mjs');
