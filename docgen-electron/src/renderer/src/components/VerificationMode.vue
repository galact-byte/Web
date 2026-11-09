<template>
  <el-radio-group v-model="model" aria-label="验证测试方式" class="verification-mode">
    <el-radio
      value="执行验证测试"
      :class="['mode-segment', { 'is-active': model === '执行验证测试' }]"
    >
      <span class="mode-segment__text">执行验证测试（漏扫、渗透）</span>
    </el-radio>

    <el-radio
      value="自愿放弃验证测试"
      :class="['mode-segment', { 'is-active': model === '自愿放弃验证测试' }]"
    >
      <span class="mode-segment__text">自愿放弃验证测试</span>
    </el-radio>
  </el-radio-group>
</template>

<script setup lang="ts">
const model = defineModel<'执行验证测试' | '自愿放弃验证测试'>({ default: '自愿放弃验证测试' })
</script>

<style scoped>
.verification-mode {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 4px;
  width: 100%;
  padding: 3px;
  border-radius: 8px;
  background-color: var(--seg-track-bg, rgba(15, 23, 42, 0.045));
  border: 1px solid var(--seg-track-border, var(--el-border-color, #e5e7eb));
  box-sizing: border-box;
  transition:
    background-color var(--transition-duration, 0.2s) ease,
    border-color var(--transition-duration, 0.2s) ease;
}

.verification-mode :deep(.el-radio.mode-segment) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 32px;
  height: auto;
  margin: 0;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--seg-item-color, #64748b);
  white-space: normal;
  text-align: center;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    background-color var(--transition-duration, 0.2s) ease,
    border-color var(--transition-duration, 0.2s) ease,
    color var(--transition-duration, 0.2s) ease,
    box-shadow var(--transition-duration, 0.2s) ease;
}

/* 彻底移除原生圆点按钮 */
.verification-mode :deep(.el-radio__input) {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.verification-mode :deep(.el-radio__label) {
  padding-left: 0;
  width: 100%;
  color: inherit !important;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 500;
  text-align: center;
}

.mode-segment__text {
  display: inline-block;
}

.verification-mode :deep(.el-radio.mode-segment:hover:not(.is-checked)) {
  color: var(--seg-item-hover-color, #1f2937);
}

.verification-mode :deep(.el-radio.mode-segment.is-checked) {
  background-color: var(--seg-active-bg, #ffffff);
  border-color: var(--seg-active-border, rgba(15, 23, 42, 0.1));
  box-shadow: var(--seg-active-shadow, 0 1px 2px rgba(15, 23, 42, 0.08));
  color: var(--seg-active-color, #111827);
}

.verification-mode :deep(.el-radio.mode-segment.is-checked .el-radio__label) {
  font-weight: 600;
  color: var(--seg-active-color, #111827) !important;
}

.verification-mode :deep(.el-radio.mode-segment:focus-within) {
  outline: 2px solid var(--accent-readable, var(--primary-color, #2563eb));
  outline-offset: 1px;
}
</style>
