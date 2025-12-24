<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant';
  content: string;
}>();
</script>

<template>
  <div class="message-row" :class="role">
    <div class="message-content">
      <div class="avatar" :class="role">
        <template v-if="role === 'user'">
          <!-- User Icon (Person) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </template>
        <template v-else>
          <!-- Bot Icon (Sparkles/AI) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
        </template>
      </div>
      <div class="text">
        {{ content }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  width: 100%;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.message-row.user {
  background-color: var(--message-user-bg);
}

.message-row.assistant {
  background-color: var(--message-ai-bg);
}

.message-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  gap: 20px;
  padding: 0 20px;
  color: var(--text-primary);
  line-height: 1.6;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.avatar.user {
  background-color: #5b5d6d;
  color: #fff;
}

.avatar.assistant {
  background-color: var(--accent-color);
  color: #fff;
  box-shadow: 0 0 10px rgba(16, 163, 127, 0.4);
}

.text {
  flex: 1;
  white-space: pre-wrap; /* Preserve line breaks */
}
</style>
