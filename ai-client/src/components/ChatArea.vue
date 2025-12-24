<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue';
import ChatMessage from './ChatMessage.vue';
import { sendChatRequest, getApiSettings, type ChatMessage as ApiMessage } from '../services/api';
import { 
  type Message,
  getOrCreateCurrentConversation,
  addMessageToConversation,
  getConversation,
  createConversation,
  setCurrentConversationId
} from '../services/storage';

const props = defineProps<{
  conversationId?: string | null;
}>();

const emit = defineEmits(['conversation-updated']);

const messages = ref<Message[]>([]);
const userInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');
const currentConversationId = ref<string | null>(null);

// Load conversation on mount
onMounted(() => {
  loadCurrentConversation();
});

// Watch for conversation ID changes from parent
watch(() => props.conversationId, (newId) => {
  if (newId && newId !== currentConversationId.value) {
    loadConversation(newId);
  }
});

function loadCurrentConversation() {
  const conv = getOrCreateCurrentConversation();
  currentConversationId.value = conv.id;
  messages.value = [...conv.messages];
  
  // Show welcome message if empty
  if (messages.value.length === 0) {
    messages.value = [
      { id: 1, role: 'assistant', content: '你好！有什么我可以帮助你的吗？' }
    ];
  }
}

function loadConversation(id: string) {
  const conv = getConversation(id);
  if (conv) {
    currentConversationId.value = conv.id;
    setCurrentConversationId(conv.id);
    messages.value = [...conv.messages];
    
    if (messages.value.length === 0) {
      messages.value = [
        { id: 1, role: 'assistant', content: '你好！有什么我可以帮助你的吗？' }
      ];
    }
    
    nextTick(() => scrollToBottom());
  }
}

// Expose method for parent to call
function startNewChat() {
  const conv = createConversation();
  currentConversationId.value = conv.id;
  messages.value = [
    { id: 1, role: 'assistant', content: '你好！有什么我可以帮助你的吗？' }
  ];
  emit('conversation-updated');
}

// Expose methods via defineExpose
defineExpose({
  startNewChat,
  loadConversation
});

async function sendMessage() {
  if (!userInput.value.trim() || isLoading.value) return;

  errorMessage.value = '';
  
  // Check API settings
  const settings = getApiSettings();
  if (!settings) {
    errorMessage.value = '请先在设置中配置 API Key 和 URL';
    return;
  }

  // Add user message
  const userMsg: Message = {
    id: Date.now(),
    role: 'user',
    content: userInput.value
  };
  messages.value.push(userMsg);
  
  // Save to storage
  if (currentConversationId.value) {
    addMessageToConversation(currentConversationId.value, userMsg);
    emit('conversation-updated');
  }
  
  userInput.value = '';
  
  await nextTick();
  scrollToBottom();

  // Send to API
  isLoading.value = true;
  
  try {
    // Build messages for API (exclude welcome message)
    const apiMessages: ApiMessage[] = messages.value
      .filter(m => m.id !== 1) // Exclude welcome message
      .map(m => ({ role: m.role, content: m.content }));
    
    const response = await sendChatRequest(apiMessages, settings);
    
    if (response.error) {
      errorMessage.value = response.error;
    } else {
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.content
      };
      messages.value.push(assistantMsg);
      
      // Save to storage
      if (currentConversationId.value) {
        addMessageToConversation(currentConversationId.value, assistantMsg);
        emit('conversation-updated');
      }
    }
  } catch (error: any) {
    errorMessage.value = error.message || '发送消息时出错';
  } finally {
    isLoading.value = false;
    await nextTick();
    scrollToBottom();
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
</script>

<template>
  <main class="chat-area">
    <div class="messages-container" ref="messagesContainer">
      <ChatMessage 
        v-for="msg in messages" 
        :key="msg.id" 
        :role="msg.role" 
        :content="msg.content" 
      />
      
      <!-- Loading indicator -->
      <div v-if="isLoading" class="loading-indicator">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
      
      <!-- Error message -->
      <div v-if="errorMessage" class="error-message">
        ⚠️ {{ errorMessage }}
      </div>
    </div>

    <div class="input-area-container">
      <div class="input-box">
        <textarea 
          v-model="userInput" 
          @keydown="handleKeydown"
          placeholder="Send a message..."
          rows="1"
        ></textarea>
        <button class="send-btn" @click="sendMessage" :disabled="!userInput.trim()">
          ➤
        </button>
      </div>
      <div class="disclaimer">
        AI can make mistakes. Consider checking important information.
      </div>
    </div>
  </main>
</template>

<style scoped>
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background-color: transparent; /* Transparent to show app background */
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 120px; /* Space for input area */
}

.input-area-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  /* Gradient fade from bottom */
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(20,20,20,0.4) 100%);
  padding-bottom: 20px;
  padding-top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.input-box {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  display: flex;
  align-items: center; /* Align items to bottom for growing textarea */
  padding: 10px 10px 10px 16px; 
  box-shadow: 0 0 15px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 768px; /* Standard chatgpt width */
  margin: 0 20px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-box:focus-within {
  border-color: rgba(255,255,255,0.2);
  box-shadow: 0 0 20px rgba(0,0,0,0.2);
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  max-height: 200px;
  outline: none;
  line-height: 1.5;
}

.send-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 5px 10px;
  font-size: 1.2rem;
  transition: color 0.2s;
}

.send-btn:not(:disabled) {
  color: var(--accent-color);
}

.send-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.disclaimer {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 10px;
  opacity: 0.7;
}

.loading-indicator {
  display: flex;
  gap: 6px;
  padding: 20px;
  justify-content: center;
}

.loading-dot {
  width: 10px;
  height: 10px;
  background: var(--accent-color);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite both;
}

.loading-dot:nth-child(1) { animation-delay: -0.32s; }
.loading-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1.2); opacity: 1; }
}

.error-message {
  max-width: 768px;
  margin: 10px auto;
  padding: 12px 20px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.9rem;
}
</style>
