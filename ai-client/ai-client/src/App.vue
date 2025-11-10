<template>
  <div class="p-6 flex flex-col h-screen bg-gray-100">
    <h1 class="text-2xl font-bold mb-4 text-center">🧠 AI 模型客户端</h1>
    <div class="flex flex-col mb-2">
      <input v-model="api_url" class="input" placeholder="API URL" />
      <input v-model="api_key" class="input" placeholder="API Key" />
      <input v-model="model" class="input" placeholder="模型名 (gemini-2.5-flash)" />
    </div>

    <div class="flex-1 overflow-y-auto bg-white rounded-lg p-3 mb-3 shadow-inner">
      <div v-for="msg in messages" :key="msg.id" class="mb-2">
        <p><strong>{{ msg.role === 'user' ? '🧑 你' : '🤖 AI' }}：</strong> {{ msg.content }}</p>
      </div>
    </div>

    <div class="flex gap-2">
      <input v-model="input" class="input flex-1" placeholder="输入你的消息..." @keyup.enter="sendMessage" />
      <button class="btn" @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const api_url = ref("http://127.0.0.1:8000/v1/chat/completions");
const api_key = ref("");
const model = ref("gemini-2.5-flash");
const input = ref("");
const messages = ref<{ role: string; content: string; id: number }[]>([]);
let id = 0;

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
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
    const data = await res.json();
    messages.value.push({
      role: "assistant",
      content: data.reply || data.error,
      id: ++id,
    });
  } catch (e) {
    messages.value.push({ role: "assistant", content: "❌ 网络错误", id: ++id });
  }
}
</script>

<style scoped>
.input {
  @apply border rounded-lg px-3 py-2 mb-1 w-full;
}
.btn {
  @apply bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600;
}
</style>
