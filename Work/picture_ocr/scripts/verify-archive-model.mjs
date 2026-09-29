// 归档标记贯穿数据模型 + 库内归档/恢复事务：隔离 Chrome 与 Electron 原生 IndexedDB 各跑一轮。
import { runBrowserCases } from './browser-cases-harness.mjs';
await runBrowserCases('scripts/archive-model-cases.mjs');
