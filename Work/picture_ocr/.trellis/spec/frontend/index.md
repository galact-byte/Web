# 前端开发规范

> 适用于本仓库 `src/` 下的 React + Vite + TypeScript 应用。规范基于当前代码和验证脚本，而非通用模板。

## 使用顺序

1. 阅读 [目录结构](./directory-structure.md) 以确定代码归属。
2. 修改 React 视图时阅读 [组件规范](./component-guidelines.md) 和 [Hook 规范](./hook-guidelines.md)。
3. 修改项目数据、持久化或路由状态时阅读 [状态管理](./state-management.md) 与 [类型安全](./type-safety.md)。
4. 实施完成后按 [质量规范](./quality-guidelines.md) 执行相称验证。

## 规范索引

| 文档 | 覆盖范围 |
| --- | --- |
| [目录结构](./directory-structure.md) | `src/` 层级、模块归属、命名 |
| [组件规范](./component-guidelines.md) | 函数组件、Props、Tailwind、可访问性 |
| [Hook 规范](./hook-guidelines.md) | Context hooks、effect、异步资源清理 |
| [状态管理](./state-management.md) | reducer、Context、IndexedDB、局部状态 |
| [类型安全](./type-safety.md) | 领域类型、严格 TypeScript、运行时边界 |
| [质量规范](./quality-guidelines.md) | 构建、验证脚本、错误处理、手工检查 |

## 修改前检查

- 确认目标属于 `components`、`context`、`types`、`utils` 或 `data` 中的既有职责边界。
- 修改共享常量、协议、路由或关键文案前先搜索全仓引用和验证脚本。
- 新增外部输入、浏览器 API 或异步资源时，明确运行时校验、错误反馈和 cleanup。
