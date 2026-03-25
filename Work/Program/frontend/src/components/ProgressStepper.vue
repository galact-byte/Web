<template>
  <div class="progress-stepper" :class="{ editable }">
    <div
      v-for="(step, index) in steps"
      :key="step.value"
      class="step"
      :class="{
        active: currentIndex === index,
        completed: currentIndex > index,
        clickable: editable,
      }"
      @click="editable && $emit('update:modelValue', step.value)"
    >
      <div class="step-dot">
        <span v-if="currentIndex > index" class="check-icon">✓</span>
        <span v-else class="step-num">{{ index + 1 }}</span>
      </div>
      <span class="step-label">{{ step.label }}</span>
      <div v-if="index < steps.length - 1" class="step-line" :class="{ filled: currentIndex > index }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const STEPS = [
  { value: 'not_started', label: '未开始' },
  { value: 'evaluation_prep', label: '测评准备' },
  { value: 'scheme_writing', label: '方案编制' },
  { value: 'onsite_eval', label: '现场测评' },
  { value: 'report_writing', label: '报告编制' },
  { value: 'archived', label: '完结归档' },
]

const props = defineProps({
  modelValue: { type: String, default: 'not_started' },
  editable: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const steps = STEPS
const currentIndex = computed(() => {
  const idx = STEPS.findIndex(s => s.value === props.modelValue)
  return idx >= 0 ? idx : 0
})
</script>

<style scoped>
.progress-stepper {
  display: flex;
  align-items: flex-start;
  gap: 0;
  width: 100%;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 0;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  transition: all 0.2s ease;
  z-index: 1;
}

.step.active .step-dot {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: white;
}

.step.completed .step-dot {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: white;
}

.check-icon {
  font-size: 0.7rem;
}

.step-label {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.step.active .step-label {
  color: var(--accent-primary);
  font-weight: 600;
}

.step.completed .step-label {
  color: var(--text-secondary);
}

.step-line {
  position: absolute;
  top: 14px;
  left: calc(50% + 14px);
  width: calc(100% - 28px);
  height: 2px;
  background: var(--border-color);
  transition: background 0.2s ease;
}

.step-line.filled {
  background: var(--accent-primary);
}

.step.clickable {
  cursor: pointer;
}

.step.clickable:hover .step-dot {
  border-color: var(--accent-primary);
  transform: scale(1.1);
}

.step.clickable:hover .step-label {
  color: var(--accent-primary);
}
</style>
