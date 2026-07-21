# 手机采集来源选择器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持一个可见的“拍照 / 选择图片”入口，同时让用户明确选择拍照或从相册选择，避免依赖不同 Android 浏览器的原生文件选择器行为。

**Architecture:** `LanMobileCollector` 在每个检查项维护两个隐藏文件输入：相机输入带 `capture="environment"`，相册输入不带 `capture`；唯一可见按钮先打开语义化选择层，再由对应操作触发隐藏输入。两个来源继续使用同一个 `uploadImage` 函数。

**Tech Stack:** React 18、TypeScript、Tailwind CSS、现有 Node 内置 assert 源码验证。

## Global Constraints

- 不修改局域网服务、上传接口、token、安全校验、文件格式或 10MB 限制。
- 页面主入口始终只有一个；“拍照”和“从相册选择”只出现在该入口打开的选择层内。
- 相机输入唯一使用 `capture="environment"`；相册输入不得使用 `capture`。
- 选择层必须有 `role="dialog"`、`aria-modal="true"`、可见标题、取消按钮和不小于 44px 的操作目标。
- 上传期间不能重复打开来源选择层；选定来源后立即关闭选择层。

---

### Task 1: 用失败验证定义双来源选择行为

**Files:**
- Modify: `scripts/verify-lan-mobile-picker.mjs`
- Modify: `src/components/LanMobileCollector.tsx`

- [ ] **Step 1: 写入失败断言**

将“不得出现 `capture="environment"`”改为断言：来源选择层存在 `role="dialog"` 与“选择图片来源”；页面含“拍照”“从相册选择”“取消”；相机输入使用 `capture="environment"`；相册输入使用相同图片格式且不含 `capture`；主按钮仍为“拍照 / 选择图片”。

- [ ] **Step 2: 运行验证并确认失败**

Run: `npm run verify:lan-mobile-picker`

Expected: FAIL，因为当前组件没有来源选择层，也没有专用相机输入。

- [ ] **Step 3: 实现最小双来源选择层**

为每个检查项维护相机/相册 input ref；点击可见主按钮只记录目标检查项并显示选择层。选择层的“拍照”触发带 `capture="environment"` 的 input，“从相册选择”触发无 capture 的 input，“取消”仅关闭选择层。两类 input 的 `onChange` 均调用已有 `uploadImage`，随后清空 input 值。

- [ ] **Step 4: 运行专项验证**

Run: `npm run verify:lan-mobile-picker`

Expected: PASS。

- [ ] **Step 5: 构建与差异检查**

Run:

```bash
npm run build
git diff --check
```

Expected: 两个命令 exit 0。

- [ ] **Step 6: 本地提交**

```bash
git add src/components/LanMobileCollector.tsx scripts/verify-lan-mobile-picker.mjs docs/superpowers/plans/2026-07-21-mobile-capture-source-picker.md
git commit -m "fix: offer explicit mobile capture sources"
```
