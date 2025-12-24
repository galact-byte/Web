<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import SettingsModal from './SettingsModal.vue';
import { getConversations, deleteConversation, type Conversation } from '../services/storage';

const props = defineProps<{
  refreshTrigger?: number;
}>();

const conversations = ref<Conversation[]>([]);
const showSettings = ref(false);

const emit = defineEmits(['new-chat', 'select-conversation']);

// Load conversations on mount
onMounted(() => {
  loadConversations();
});

// Reload when refresh trigger changes
watch(() => props.refreshTrigger, () => {
  loadConversations();
});

function loadConversations() {
  conversations.value = getConversations();
}

function startNewChat() {
  emit('new-chat');
}

function selectConversation(id: string) {
  emit('select-conversation', id);
}

function removeConversation(e: Event, id: string) {
  e.stopPropagation();
  deleteConversation(id);
  loadConversations();
}

function openSettings() {
  showSettings.value = true;
}

function closeSettings() {
  showSettings.value = false;
}

function handleApiKeySave(_settings: any) {
  console.log('Settings saved');
}
</script>

<template>
  <aside class="sidebar">
    <button class="new-chat-btn" @click="startNewChat">
      <span>+</span> New chat
    </button>

    <div class="history-list">
      <template v-if="conversations.length > 0">
        <div 
          v-for="conv in conversations" 
          :key="conv.id" 
          class="history-item"
          @click="selectConversation(conv.id)"
        >
          <span class="icon">💬</span>
          <span class="title">{{ conv.title }}</span>
          <button class="delete-btn" @click="removeConversation($event, conv.id)" title="删除对话">
            ✕
          </button>
        </div>
      </template>
      <div v-else class="empty-history">
        <p>暂无对话历史</p>
        <p class="hint">点击上方按钮开始新对话</p>
      </div>
    </div>
    
    <div class="user-menu">
      <div class="user-item" @click="openSettings">
        <span class="avatar">👤</span>
        <span class="username">User</span>
        <span class="settings-icon">⚙️</span>
      </div>
    </div>

    <SettingsModal 
      :visible="showSettings" 
      @close="closeSettings"
      @save="handleApiKeySave"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background-color: var(--sidebar-bg); /* Now uses rgba */
  display: flex;
  flex-direction: column;
  padding: 10px;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  height: 100%;
  backdrop-filter: blur(10px); /* Glass effect */
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.new-chat-btn:hover {
  background-color: rgba(255, 255, 255, 0.05); /* Transparent hover */
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background-color 0.2s;
  font-size: 0.9rem;
  position: relative;
}

.history-item:hover {
  background-color: rgba(255, 255, 255, 0.05); /* Transparent hover */
}

.history-item .title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item .delete-btn {
  display: none;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.history-item:hover .delete-btn {
  display: block;
}

.history-item .delete-btn:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  text-align: center;
}

.empty-history p {
  margin: 0;
}

.empty-history .hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 8px;
}

.user-menu {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  margin-top: 10px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
}

.user-item:hover {
  background-color: rgba(255, 255, 255, 0.05); /* Transparent hover */
}

.settings-icon {
  margin-left: auto;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.user-item:hover .settings-icon {
  opacity: 1;
}

/* Mobile responsiveness could be added here with media queries */
@media (max-width: 768px) {
  .sidebar {
    display: none; /* Hide sidebar on mobile for now, or use a toggle */
  }
}
</style>
