// 归档/恢复编排：隔离 Chrome 与 Electron 各跑一轮（Web 目标用 OPFS 真实文件句柄）。
import { runBrowserCases } from './browser-cases-harness.mjs';
await runBrowserCases('scripts/archive-flow-cases.mjs');
