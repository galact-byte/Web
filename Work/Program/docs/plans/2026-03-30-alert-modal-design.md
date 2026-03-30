# 全局提示弹框 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把前端页面中直接使用的浏览器原生 `alert` 替换为项目内统一的居中提示弹框。

**Architecture:** 新增一个全局提示状态模块，暴露可 `await` 的 `showAppAlert()` 方法；在根组件挂载统一弹框组件，按队列显示消息。各页面把 `alert(...)` 替换为 `await showAppAlert(...)`，确保原有顺序语义尽量保持不变。

**Tech Stack:** Vue 3、Vite、Pinia 现有前端结构、全局 CSS 变量主题

---

### Task 1: 全局提示状态与组件

**Files:**
- Create: `frontend/src/components/AppAlert.vue`
- Create: `frontend/src/services/appAlert.js`
- Modify: `frontend/src/App.vue`

**Step 1: 定义失败验证目标**

确认当前项目中存在多个 `alert(...)` 调用，且根组件未挂载统一提示层。

**Step 2: 写最小实现**

新增全局队列状态、`showAppAlert()` 方法和根级组件挂载，支持消息、标题、类型、确认按钮。

**Step 3: 本地验证**

运行：`npm run build`
期望：前端成功构建，无语法错误。

### Task 2: 页面替换

**Files:**
- Modify: `frontend/src/views/Backup.vue`
- Modify: `frontend/src/views/Export.vue`
- Modify: `frontend/src/views/ProjectForm.vue`
- Modify: `frontend/src/views/Projects.vue`
- Modify: `frontend/src/views/Users.vue`

**Step 1: 替换调用点**

把各页面原生 `alert(...)` 改为 `await showAppAlert(...)`，并按成功/失败语义设置类型。

**Step 2: 本地验证**

运行：`npm run build`
期望：前端成功构建，替换后的调用全部通过编译。
