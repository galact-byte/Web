<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <!-- 顶部标题栏 -->
    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 shadow-lg">
      <h1 class="text-2xl font-bold text-center">🧠 AI 模型客户端</h1>
    </div>

    <!-- 选项卡导航 -->
    <div class="flex border-b bg-white shadow-sm">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex-1 py-3 px-4 font-medium transition-all',
          activeTab === tab.id
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
            : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
        ]"
      >
        {{ tab.icon }} {{ tab.name }}
      </button>
    </div>

    <!-- 选项卡内容 -->
    <div class="flex-1 overflow-hidden">
      <!-- 聊天选项卡 -->
      <div v-show="activeTab === 'chat'" class="h-full flex">
        <!-- 左侧：聊天历史列表 -->
        <div class="w-64 bg-gray-800 text-white flex flex-col">
          <!-- 新建对话按钮 -->
          <div class="p-3 border-b border-gray-700">
            <button
              @click="createNewChat"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
            >
              <span>✨</span>
              <span>新建对话</span>
            </button>
          </div>

          <!-- 聊天历史列表 -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            <div
              v-for="chat in chatHistory"
              :key="chat.id"
              @click="switchChat(chat.id)"
              :class="[
                'p-3 rounded-lg cursor-pointer transition-all group relative',
                currentChatId === chat.id
                  ? 'bg-gray-700 border-l-4 border-blue-500'
                  : 'hover:bg-gray-700'
              ]"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ chat.title }}</p>
                  <p class="text-xs text-gray-400 truncate">
                    {{ chat.messages.length }} 条消息
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ formatDate(chat.updatedAt) }}
                  </p>
                </div>
                <button
                  @click.stop="deleteChat(chat.id)"
                  class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                  title="删除对话"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div v-if="chatHistory.length === 0" class="text-center text-gray-500 py-8">
              <p>暂无历史记录</p>
              <p class="text-xs mt-2">点击上方按钮创建新对话</p>
            </div>
          </div>

          <!-- 底部统计 -->
          <div class="p-3 border-t border-gray-700 text-xs text-gray-400">
            <p>总对话数: {{ chatHistory.length }}</p>
            <p>当前对话: {{ currentChat?.messages.length || 0 }} 条消息</p>
          </div>
        </div>

        <!-- 右侧：聊天内容 -->
        <div class="flex-1 flex flex-col">
          <!-- 后端状态提示 -->
          <div
            v-if="backendStatus !== 'ready'"
            class="m-4 p-3 rounded-lg flex items-center gap-2"
            :class="{
              'bg-yellow-100 text-yellow-800': backendStatus === 'checking',
              'bg-red-100 text-red-800': backendStatus === 'error'
            }"
          >
            <span v-if="backendStatus === 'checking'">⏳ 正在连接后端...</span>
            <span v-if="backendStatus === 'error'">❌ 后端连接失败，请检查日志选项卡</span>
          </div>

          <!-- 聊天消息区域 -->
          <div
            ref="chatContainer"
            class="flex-1 overflow-y-auto p-4 space-y-3"
          >
            <div v-if="!currentChat" class="flex items-center justify-center h-full text-gray-400">
              <div class="text-center">
                <p class="text-4xl mb-4">💬</p>
                <p class="text-lg">请选择或创建一个对话</p>
              </div>
            </div>

            <div
              v-else
              v-for="msg in currentChat.messages"
              :key="msg.id"
              :class="[
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              ]"
            >
              <div
                :class="[
                  'p-3 rounded-lg max-w-[70%]',
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : msg.role === 'assistant'
                    ? 'bg-white shadow-md text-gray-800'
                    : 'bg-yellow-50 text-yellow-800 text-sm'
                ]"
              >
                <p class="font-semibold text-sm mb-1">
                  {{
                    msg.role === 'user'
                      ? '🧑 你'
                      : msg.role === 'assistant'
                      ? '🤖 AI'
                      : '⚙️ 系统'
                  }}
                </p>
                <p class="whitespace-pre-wrap">{{ msg.content }}</p>
                <p class="text-xs opacity-70 mt-1">
                  {{ formatTime(msg.timestamp) }}
                </p>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="p-4 bg-white border-t">
            <div class="flex gap-2">
              <input
                v-model="input"
                class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入你的消息..."
                @keyup.enter="sendMessage"
                :disabled="backendStatus !== 'ready' || !currentChat"
              />
              <button
                class="bg-blue-500 text-white rounded-lg px-6 py-2 hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                @click="sendMessage"
                :disabled="backendStatus !== 'ready' || !input.trim() || isSending || !currentChat"
              >
                {{ isSending ? '发送中...' : '发送' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 配置选项卡 -->
      <div v-show="activeTab === 'config'" class="h-full overflow-y-auto p-6">
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 class="text-xl font-bold text-gray-800 mb-4">⚙️ 模型配置</h2>

          <!-- 模型选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              选择 AI 服务商
            </label>
            <select
              v-model="selectedProvider"
              @change="onProviderChange"
              class="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="custom">自定义</option>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="google">Google (Gemini)</option>
            </select>
          </div>

          <!-- API URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              API URL
            </label>
            <input
              v-model="config.api_url"
              class="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.openai.com/v1/chat/completions"
            />
            <p class="text-xs text-gray-500 mt-1">
              {{ providerHints[selectedProvider]?.url }}
            </p>
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div class="relative">
              <input
                :type="showApiKey ? 'text' : 'password'"
                v-model="config.api_key"
                class="w-full border rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sk-..."
              />
              <button
                @click="showApiKey = !showApiKey"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {{ showApiKey ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- 模型名称 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              模型名称
            </label>
            <input
              v-model="config.model"
              class="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="gpt-4"
            />
            <p class="text-xs text-gray-500 mt-1">
              {{ providerHints[selectedProvider]?.model }}
            </p>
          </div>

          <!-- 保存按钮 -->
          <div class="flex gap-3 pt-4">
            <button
              @click="saveConfig"
              class="flex-1 bg-green-500 text-white rounded-lg px-4 py-2 hover:bg-green-600 transition-colors"
            >
              💾 保存配置
            </button>
            <button
              @click="testConnection"
              class="flex-1 bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors"
              :disabled="isTesting"
            >
              {{ isTesting ? '测试中...' : '🔍 测试连接' }}
            </button>
          </div>

          <!-- 保存状态提示 -->
          <div
            v-if="saveMessage"
            class="p-3 rounded-lg text-center"
            :class="saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
          >
            {{ saveMessage.text }}
          </div>
        </div>
      </div>

      <!-- 日志选项卡 -->
      <div v-show="activeTab === 'logs'" class="h-full flex flex-col p-4">
        <div class="bg-white rounded-lg shadow-md p-4 mb-3 flex justify-between items-center">
          <h2 class="text-lg font-bold text-gray-800">📋 系统日志</h2>
          <div class="flex gap-2">
            <button
              @click="refreshLogs"
              class="bg-blue-500 text-white rounded px-3 py-1 text-sm hover:bg-blue-600 transition-colors"
            >
              🔄 刷新
            </button>
            <button
              @click="exportLogs"
              class="bg-green-500 text-white rounded px-3 py-1 text-sm hover:bg-green-600 transition-colors"
            >
              💾 导出日志
            </button>
            <button
              @click="clearLogs"
              class="bg-red-500 text-white rounded px-3 py-1 text-sm hover:bg-red-600 transition-colors"
            >
              🗑️ 清空
            </button>
          </div>
        </div>

        <div
          ref="logContainer"
          class="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 shadow-inner"
        >
          <div v-if="logs.length === 0" class="text-gray-500 text-center py-8">
            暂无日志记录
          </div>
          <div v-for="(log, index) in logs" :key="index" class="mb-1 whitespace-pre-wrap">
            <span
              :class="{
                'text-green-400': log.includes('✅') || log.includes('SUCCESS'),
                'text-red-400': log.includes('❌') || log.includes('ERROR') || log.includes('错误'),
                'text-yellow-400': log.includes('⚠️') || log.includes('WARN'),
                'text-blue-400': log.includes('ℹ️') || log.includes('INFO')
              }"
            >
              {{ log }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue';

// ========== 类型定义 ==========
interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface Config {
  api_url: string;
  api_key: string;
  model: string;
}

// ========== 选项卡管理 ==========
const tabs = [
  { id: 'chat', name: '聊天', icon: '💬' },
  { id: 'config', name: '配置', icon: '⚙️' },
  { id: 'logs', name: '日志', icon: '📋' }
];
const activeTab = ref('chat');

// ========== 聊天历史管理 ==========
const chatHistory = ref<ChatSession[]>([]);
const currentChatId = ref<string | null>(null);
const input = ref('');
const isSending = ref(false);
const chatContainer = ref<HTMLElement | null>(null);
let messageId = 0;

const currentChat = computed(() => {
  if (!currentChatId.value) return null;
  return chatHistory.value.find(chat => chat.id === currentChatId.value) || null;
});

function createNewChat() {
  const newChat: ChatSession = {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: `新对话 ${chatHistory.value.length + 1}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  chatHistory.value.unshift(newChat);
  currentChatId.value = newChat.id;
  saveChatHistory();
  addLog(`✨ 创建新对话: ${newChat.title}`);
}

function switchChat(chatId: string) {
  currentChatId.value = chatId;
  addLog(`🔄 切换到对话: ${chatHistory.value.find(c => c.id === chatId)?.title}`);
  nextTick(() => scrollToBottom());
}

function deleteChat(chatId: string) {
  const chat = chatHistory.value.find(c => c.id === chatId);
  if (!chat) return;
  
  if (confirm(`确定要删除对话"${chat.title}"吗？`)) {
    chatHistory.value = chatHistory.value.filter(c => c.id !== chatId);
    
    if (currentChatId.value === chatId) {
      currentChatId.value = chatHistory.value.length > 0 ? chatHistory.value[0].id : null;
    }
    
    saveChatHistory();
    addLog(`🗑️ 删除对话: ${chat.title}`);
  }
}

function updateChatTitle(chatId: string, firstMessage: string) {
  const chat = chatHistory.value.find(c => c.id === chatId);
  if (!chat) return;
  
  // 使用第一条用户消息的前20个字符作为标题
  chat.title = firstMessage.substring(0, 20) + (firstMessage.length > 20 ? '...' : '');
  chat.updatedAt = Date.now();
  saveChatHistory();
}

function saveChatHistory() {
  try {
    localStorage.setItem('ai-client-chat-history', JSON.stringify(chatHistory.value));
  } catch (e) {
    addLog(`⚠️ 保存聊天历史失败: ${e}`);
  }
}

function loadChatHistory() {
  try {
    const saved = localStorage.getItem('ai-client-chat-history');
    if (saved) {
      chatHistory.value = JSON.parse(saved);
      if (chatHistory.value.length > 0) {
        currentChatId.value = chatHistory.value[0].id;
      }
      addLog(`✅ 已加载 ${chatHistory.value.length} 条历史记录`);
    }
  } catch (e) {
    addLog(`⚠️ 加载聊天历史失败: ${e}`);
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || backendStatus.value !== 'ready' || isSending.value || !currentChat.value) return;

  isSending.value = true;
  
  const userMessage: Message = {
    id: ++messageId,
    role: 'user',
    content: text,
    timestamp: Date.now()
  };
  
  currentChat.value.messages.push(userMessage);
  
  // 如果是第一条消息，更新对话标题
  if (currentChat.value.messages.filter(m => m.role === 'user').length === 1) {
    updateChatTitle(currentChat.value.id, text);
  }
  
  input.value = '';
  scrollToBottom();
  saveChatHistory();

  addLog(`📤 发送消息: ${text.substring(0, 50)}...`);

  try {
    const res = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        api_url: config.value.api_url,
        api_key: config.value.api_key,
        model: config.value.model
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = data.reply || data.error || '⚠️ 无响应';
    
    const aiMessage: Message = {
      id: ++messageId,
      role: data.error ? 'system' : 'assistant',
      content,
      timestamp: Date.now()
    };
    
    currentChat.value.messages.push(aiMessage);
    currentChat.value.updatedAt = Date.now();
    
    addLog(`📥 收到回复: ${content.substring(0, 50)}...`);
    scrollToBottom();
    saveChatHistory();
  } catch (e) {
    const errorMsg = `❌ 发送失败: ${e}`;
    currentChat.value.messages.push({
      id: ++messageId,
      role: 'system',
      content: errorMsg,
      timestamp: Date.now()
    });
    addLog(errorMsg);
    saveChatHistory();
  } finally {
    isSending.value = false;
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

function formatDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ========== 配置管理 ==========
const config = ref<Config>({
  api_url: 'https://ghjlr-text-op.hf.space/v1/chat/completions',
  api_key: '',
  model: 'gemini-2.5-flash'
});

const selectedProvider = ref('custom');
const showApiKey = ref(false);
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const isTesting = ref(false);

const providerHints: Record<string, { url: string; model: string }> = {
  custom: {
    url: '输入自定义的 API 端点',
    model: '输入对应的模型名称'
  },
  openai: {
    url: '标准：https://api.openai.com/v1/chat/completions',
    model: '例如：gpt-4, gpt-3.5-turbo'
  },
  anthropic: {
    url: '标准：https://api.anthropic.com/v1/messages',
    model: '例如：claude-3-opus-20240229'
  },
  google: {
    url: '例如：https://generativelanguage.googleapis.com/v1beta/...',
    model: '例如：gemini-pro, gemini-2.5-flash'
  }
};

function onProviderChange() {
  if (selectedProvider.value !== 'custom') {
    addLog(`ℹ️ 已选择 ${selectedProvider.value} 服务商，请填写 API Key`);
  }
}

function saveConfig() {
  try {
    localStorage.setItem('ai-client-config', JSON.stringify(config.value));
    saveMessage.value = { type: 'success', text: '✅ 配置已保存' };
    addLog('✅ 配置保存成功');
    setTimeout(() => {
      saveMessage.value = null;
    }, 3000);
  } catch (e) {
    saveMessage.value = { type: 'error', text: '❌ 保存失败' };
    addLog(`❌ 配置保存失败: ${e}`);
  }
}

function loadConfig() {
  try {
    const saved = localStorage.getItem('ai-client-config');
    if (saved) {
      config.value = JSON.parse(saved);
      addLog('✅ 已加载保存的配置');
    }
  } catch (e) {
    addLog(`⚠️ 加载配置失败: ${e}`);
  }
}

async function testConnection() {
  isTesting.value = true;
  addLog('🔍 开始测试连接...');
  
  try {
    const res = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi',
        api_url: config.value.api_url,
        api_key: config.value.api_key,
        model: config.value.model
      })
    });
    
    const data = await res.json();
    
    if (data.error) {
      saveMessage.value = { type: 'error', text: `❌ 测试失败: ${data.error}` };
      addLog(`❌ 连接测试失败: ${data.error}`);
    } else {
      saveMessage.value = { type: 'success', text: '✅ 连接测试成功！' };
      addLog('✅ 连接测试成功，配置正确');
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: `❌ 测试失败: ${e}` };
    addLog(`❌ 连接测试异常: ${e}`);
  } finally {
    isTesting.value = false;
    setTimeout(() => {
      saveMessage.value = null;
    }, 5000);
  }
}

// ========== 后端状态管理 ==========
const backendStatus = ref<'checking' | 'ready' | 'error'>('checking');

async function waitForBackend(timeout = 10000) {
  addLog('🔍 检查后端服务状态...');
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch('http://127.0.0.1:8000/health', {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      
      if (res.ok) {
        addLog('✅ 后端服务已就绪');
        return true;
      }
    } catch (e) {
      // 继续等待
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  addLog('❌ 后端连接超时');
  return false;
}

// ========== 日志管理 ==========
const logs = ref<string[]>([]);
const logContainer = ref<HTMLElement | null>(null);

function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  logs.value.push(`[${timestamp}] ${message}`);
  
  nextTick(() => {
    if (logContainer.value && activeTab.value === 'logs') {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

function refreshLogs() {
  addLog('🔄 日志已刷新');
}

function exportLogs() {
  try {
    const logContent = logs.value.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-client-logs-${new Date().toISOString().replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('💾 日志已导出');
  } catch (e) {
    addLog(`❌ 导出日志失败: ${e}`);
  }
}

function clearLogs() {
  logs.value = [];
  addLog('🗑️ 日志已清空');
}

// 监听选项卡切换
watch(activeTab, () => {
  nextTick(() => {
    if (activeTab.value === 'logs' && logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    } else if (activeTab.value === 'chat' && chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
});

// ========== 初始化 ==========
onMounted(async () => {
  addLog('🚀 AI 客户端启动');
  loadConfig();
  loadChatHistory();

  const ready = await waitForBackend();
  
  if (ready) {
    backendStatus.value = 'ready';
    addLog('✅ 系统已就绪');
    
    // 如果没有对话，创建第一个
    if (chatHistory.value.length === 0) {
      createNewChat();
    }
  } else {
    backendStatus.value = 'error';
    addLog('❌ 后端连接失败，请检查日志');
  }
});
</script>

<style scoped>
/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 深色侧边栏的滚动条 */
.bg-gray-800 ::-webkit-scrollbar-track {
  background: #374151;
}

.bg-gray-800 ::-webkit-scrollbar-thumb {
  background: #6b7280;
}

.bg-gray-800 ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>