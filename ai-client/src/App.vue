<script setup lang="ts">
import { ref, provide, onMounted } from 'vue';
import Sidebar from './components/Sidebar.vue';
import ChatArea from './components/ChatArea.vue';

const chatAreaRef = ref<InstanceType<typeof ChatArea> | null>(null);
const selectedConversationId = ref<string | null>(null);
const refreshTrigger = ref(0);

// Background Settings State
const bgImage = ref('bg_default.jpg');
const bgOverlayColor = ref('#000000');
const bgOpacity = ref(0.4);

// Load settings from local storage
onMounted(() => {
  const savedBg = localStorage.getItem('ui_bg_image');
  const savedColor = localStorage.getItem('ui_bg_color');
  const savedOpacity = localStorage.getItem('ui_bg_opacity');
  
  if (savedBg) bgImage.value = savedBg;
  if (savedColor) bgOverlayColor.value = savedColor;
  if (savedOpacity) bgOpacity.value = parseFloat(savedOpacity);
});

function handleNewChat() {
  if (chatAreaRef.value) {
    chatAreaRef.value.startNewChat();
  }
  refreshTrigger.value++;
}

function handleSelectConversation(id: string) {
  selectedConversationId.value = id;
  if (chatAreaRef.value) {
    chatAreaRef.value.loadConversation(id);
  }
}

function handleConversationUpdated() {
  refreshTrigger.value++;
}

function handleSettingsUpdate(settings: any) {
  if (settings.bgImage !== undefined) {
    bgImage.value = settings.bgImage;
    localStorage.setItem('ui_bg_image', settings.bgImage);
  }
  if (settings.bgColor !== undefined) {
    bgOverlayColor.value = settings.bgColor;
    localStorage.setItem('ui_bg_color', settings.bgColor);
  }
  if (settings.bgOpacity !== undefined) {
    bgOpacity.value = settings.bgOpacity;
    localStorage.setItem('ui_bg_opacity', settings.bgOpacity.toString());
  }
}

// Provide settings updater to descendants
provide('updateUISettings', handleSettingsUpdate);
provide('uiSettings', {
  bgImage,
  bgOverlayColor,
  bgOpacity
});
</script>

<template>
  <div class="app-background" :style="{ backgroundImage: `url(${bgImage})` }">
    <div class="app-overlay" :style="{ backgroundColor: bgOverlayColor, opacity: bgOpacity }"></div>
  </div>
  
  <div class="layout-container">
    <Sidebar 
      :refresh-trigger="refreshTrigger"
      @new-chat="handleNewChat" 
      @select-conversation="handleSelectConversation"
    />
    <ChatArea 
      ref="chatAreaRef"
      :conversation-id="selectedConversationId"
      @conversation-updated="handleConversationUpdated"
    />
  </div>
</template>

<style scoped>
</style>