<template>
  <div class="p-6 flex flex-col h-screen bg-gray-100">
    <h1 class="text-2xl font-bold mb-4 text-center">🧠 AI 模型客户端</h1>

    <!-- ✅ 显示后端状态 -->
    <div v-if="backendStatus !== 'ready'" class="mb-3 p-3 rounded-lg" :class="{
      'bg-yellow-100 text-yellow-800': backendStatus === 'checking',
      'bg-red-100 text-red-800': backendStatus === 'error'
    }">
      <p v-if="backendStatus === 'checking'">⏳ 正在连接后端...</p>
      <p v-if="backendStatus === 'error'">❌ 后端连接失败，请重启程序</p>
    </div>

    <div class="flex flex-col mb-2">
      <input v-model="api_url" class="input" placeholder="API URL" />
      <input v-model="api_key" class="input" placeholder="API Key" />
      <input v-model="model" class="input" placeholder="模型名 (gemini-2.5-flash)" />
    </div>

    <div class="flex-1 overflow-y-auto bg-white rounded-lg p-3 mb-3 shadow-inner">
      <div v-for="msg in messages" :key="msg.id" class="mb-2">
        <p :class="{
          'text-blue-600': msg.role === 'user',
          'text-green-600': msg.role === 'assistant',
          'text-gray-500': msg.role === 'system'
        }">
          <strong>{{ msg.role === 'user' ? '🧑 你' : msg.role === 'assistant' ? '🤖 AI' : '⚙️ 系统' }}：</strong>
          {{ msg.content }}
        </p>
      </div>
    </div>

    <div class="flex gap-2">
      <input
        v-model="input"
        class="input flex-1"
        placeholder="输入你的消息..."
        @keyup.enter="sendMessage"
        :disabled="backendStatus !== 'ready'"
      />
      <button 
        class="btn" 
        @click="sendMessage"
        :disabled="backendStatus !== 'ready' || !input.trim()"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const api_url = ref("https://ghjlr-text-op.hf.space/v1/chat/completions");
const api_key = ref("");
const model = ref("gemini-2.5-flash");
const input = ref("");
const messages = ref<{ role: string; content: string; id: number }[]>([]);
const backendStatus = ref<'checking' | 'ready' | 'error'>('checking');
let id = 0;

/** ✅ 检查后端是否可用 */
async function waitForBackend(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch("http://127.0.0.1:8000/health", {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        console.log("✅ 后端已就绪");
        return true;
      }
    } catch (e) {
      console.log("⏳ 等待后端启动...", e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** ✅ 发送消息逻辑 */
async function sendMessage() {
  const text = input.value.trim();
  if (!text || backendStatus.value !== 'ready') return;
  
  messages.value.push({ role: "user", content: text, id: ++id });
  input.value = "";

  try {
    const res = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        api_url: api_url.value,
        api_key: api_key.value,
        model: model.value,
      }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    messages.value.push({
      role: "assistant",
      content: data.reply || data.error || "⚠️ 无响应",
      id: ++id,
    });
  } catch (e) {
    console.error("发送消息失败:", e);
    messages.value.push({ 
      role: "system", 
      content: `❌ 网络错误: ${e}`, 
      id: ++id 
    });
  }
}

/** ✅ 启动逻辑 */
onMounted(async () => {
  console.log("🔍 检查后端连接...");
  
  const ready = await waitForBackend();
  if (ready) {
    backendStatus.value = 'ready';
    messages.value.push({
      role: "system",
      content: "✅ 后端已就绪，可以开始对话",
      id: ++id,
    });
  } else {
    backendStatus.value = 'error';
    messages.value.push({
      role: "system",
      content: "⚠️ 后端连接超时，请检查：\n1. 是否被防火墙拦截\n2. 端口8000是否被占用\n3. 尝试重启程序",
      id: ++id,
    });
  }
});

onUnmounted(() => {
  console.log("🛑 前端组件卸载");
});
</script>

<style scoped>
.input {
  @apply border rounded-lg px-3 py-2 mb-1 w-full;
}
.input:disabled {
  @apply bg-gray-200 cursor-not-allowed;
}
.btn {
  @apply bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors;
}
.btn:disabled {
  @apply bg-gray-400 cursor-not-allowed hover:bg-gray-400;
}
</style>