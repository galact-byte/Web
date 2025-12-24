<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue';

interface Provider {
  id: string;
  name: string;
  apiUrl: string;
  models: string[];
  placeholder: string;
}

const providers: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    placeholder: 'sk-...'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIza...'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-coder'],
    placeholder: 'sk-...'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro'],
    placeholder: 'sk-or-...'
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    apiUrl: '',
    models: [],
    placeholder: 'Your API Key'
  }
];

// Inject Settings
const uiSettings = inject('uiSettings') as any;
const updateUISettings = inject('updateUISettings') as any;

const bgImage = ref('bg_default.jpg');
const bgOverlayColor = ref('#000000');
const bgOpacity = ref(0.4);

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['close', 'save']);

const selectedProviderId = ref('openai');
const apiKey = ref('');
const apiUrl = ref('');
const selectedModel = ref('');
const customModel = ref('');

const currentProvider = computed(() => {
  return providers.find(p => p.id === selectedProviderId.value) || providers[0];
});

const isCustomProvider = computed(() => selectedProviderId.value === 'custom');

const activeTab = ref<'api' | 'appearance'>('api');

// ... (existing computed)

// Load from localStorage & Injected State on mount/visible
function loadSettings() {
  // ... (existing load logic)
  const storedProvider = localStorage.getItem('ai_provider');
  const storedApiKey = localStorage.getItem('ai_api_key');
  const storedApiUrl = localStorage.getItem('ai_api_url');
  const storedModel = localStorage.getItem('ai_model');
  
  if (storedProvider) selectedProviderId.value = storedProvider;
  if (storedApiKey) apiKey.value = storedApiKey;
  if (storedApiUrl) apiUrl.value = storedApiUrl;
  
  // UI Settings
  if (uiSettings) {
    if (uiSettings.bgImage.value) bgImage.value = uiSettings.bgImage.value;
    if (uiSettings.bgOverlayColor.value) bgOverlayColor.value = uiSettings.bgOverlayColor.value;
    if (uiSettings.bgOpacity.value !== undefined) bgOpacity.value = uiSettings.bgOpacity.value;
  }
  
  // Load model based on provider
  if (storedModel) {
    const provider = providers.find(p => p.id === storedProvider);
    if (provider && provider.models.length > 0 && provider.models.includes(storedModel)) {
      selectedModel.value = storedModel;
    } else {
      customModel.value = storedModel;
    }
  }
}

// Update API URL when provider changes
watch(selectedProviderId, (newId) => {
  const provider = providers.find(p => p.id === newId);
  if (provider && newId !== 'custom') {
    apiUrl.value = provider.apiUrl;
    if (provider.models.length > 0) {
      selectedModel.value = provider.models[0];
    }
  }
}, { immediate: true });

// Reset form when modal opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadSettings();
  }
});

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      bgImage.value = e.target.result as string;
    }
  };
  reader.readAsDataURL(file);
}

function saveSettings() {
  // ... (existing save logic)
  // Save UI Settings
  if (updateUISettings) {
    updateUISettings({
      bgImage: bgImage.value,
      bgColor: bgOverlayColor.value,
      bgOpacity: bgOpacity.value
    });
  }

  // Determine the model to save
  const modelToSave = currentProvider.value.models.length > 0 
    ? selectedModel.value 
    : customModel.value;
  
  localStorage.setItem('ai_provider', selectedProviderId.value);
  localStorage.setItem('ai_api_key', apiKey.value);
  localStorage.setItem('ai_api_url', apiUrl.value);
  localStorage.setItem('ai_model', modelToSave);
  
  emit('save', {
    provider: selectedProviderId.value,
    apiKey: apiKey.value,
    apiUrl: apiUrl.value,
    model: modelToSave
  });
  emit('close');
}

function closeModal() {
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <div class="modal-header">
            <h2>⚙️ API 设置</h2>
            <button class="close-btn" @click="closeModal">✕</button>
          </div>
          
          <div class="modal-body">
            <!-- Tabs -->
            <div class="modal-tabs">
              <button 
                class="tab-btn" 
                :class="{ active: activeTab === 'api' }"
                @click="activeTab = 'api'"
              >
                API 配置
              </button>
              <button 
                class="tab-btn" 
                :class="{ active: activeTab === 'appearance' }"
                @click="activeTab = 'appearance'"
              >
                外观设置
              </button>
            </div>

            <div v-if="activeTab === 'api'" class="tab-content">
              <!-- Provider Selection -->
              <div class="setting-group">
                <label for="provider">服务提供商</label>
                <div class="select-wrapper">
                  <select 
                    id="provider" 
                    v-model="selectedProviderId"
                    class="select-input"
                  >
                    <option 
                      v-for="provider in providers" 
                      :key="provider.id" 
                      :value="provider.id"
                    >
                      {{ provider.name }}
                    </option>
                  </select>
                  <span class="select-arrow">▼</span>
                </div>
              </div>

              <!-- API Key -->
              <div class="setting-group">
                <label for="api-key">API Key</label>
                <div class="input-wrapper">
                  <input 
                    id="api-key"
                    type="password" 
                    v-model="apiKey" 
                    :placeholder="currentProvider.placeholder"
                    autocomplete="off"
                  />
                </div>
              </div>

              <!-- API URL -->
              <div class="setting-group">
                <label for="api-url">
                  API URL
                  <span v-if="!isCustomProvider" class="label-badge">自动填充</span>
                </label>
                <div class="input-wrapper">
                  <input 
                    id="api-url"
                    type="text" 
                    v-model="apiUrl" 
                    placeholder="https://api.example.com/v1/chat/completions"
                    :readonly="!isCustomProvider"
                    :class="{ readonly: !isCustomProvider }"
                  />
                </div>
                <p v-if="selectedProviderId === 'google'" class="hint">
                  注: {model} 会自动替换为选择的模型名称
                </p>
              </div>

              <!-- Model Selection -->
              <div class="setting-group">
                <label for="model">模型</label>
                <template v-if="currentProvider.models.length > 0">
                  <div class="select-wrapper">
                    <select 
                      id="model" 
                      v-model="selectedModel"
                      class="select-input"
                    >
                      <option 
                        v-for="model in currentProvider.models" 
                        :key="model" 
                        :value="model"
                      >
                        {{ model }}
                      </option>
                    </select>
                    <span class="select-arrow">▼</span>
                  </div>
                </template>
                <template v-else>
                  <div class="input-wrapper">
                    <input 
                      id="custom-model"
                      type="text" 
                      v-model="customModel" 
                      placeholder="输入模型名称，如 gemini-2.5-flash"
                    />
                  </div>
                </template>
              </div>

              <p class="hint security-hint">
                🔒 所有设置仅保存在本地浏览器中，不会上传到任何服务器。
              </p>
            </div>

            <div v-if="activeTab === 'appearance'" class="tab-content">
              <!-- Background Image -->
              <div class="setting-group">
                <label for="bg-image">背景图片 URL</label>
                <div class="input-wrapper with-btn">
                  <input 
                    id="bg-image"
                    type="text" 
                    v-model="bgImage" 
                    placeholder="https://... or local path"
                  />
                  <button class="small-btn" @click="bgImage = 'bg_default.jpg'" title="恢复默认">
                    默认
                  </button>
                </div>
              </div>

              <!-- Local File Selection -->
              <div class="setting-group">
                <label for="file-upload">或选择本地图片</label>
                 <div class="file-upload-wrapper">
                  <label class="file-upload-btn">
                    选择图片...
                    <input 
                      id="file-upload"
                      type="file" 
                      accept="image/*"
                      @change="handleFileUpload"
                    />
                  </label>
                  <span class="file-hint">支持 JPG, PNG</span>
                </div>
              </div>

              <!-- Overlay Color -->
              <div class="setting-group">
                <label for="bg-color">遮罩颜色</label>
                <div class="color-picker-wrapper">
                  <input 
                    id="bg-color"
                    type="color" 
                    v-model="bgOverlayColor" 
                  />
                  <span class="color-value">{{ bgOverlayColor }}</span>
                </div>
              </div>

              <!-- Opacity -->
              <div class="setting-group">
                <label for="bg-opacity">遮罩不透明度: {{ Math.round(bgOpacity * 100) }}%</label>
                <input 
                  id="bg-opacity"
                  type="range" 
                  v-model.number="bgOpacity" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  class="range-input"
                />
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" @click="closeModal">取消</button>
            <button class="btn-primary" @click="saveSettings">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: linear-gradient(145deg, #2b2c31, #1e1f23);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
}

.input-wrapper input {
  width: 100%;
  padding: 12px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s;
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.15);
}

.input-wrapper input::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 8px;
  opacity: 0.8;
}

.security-hint {
  margin-top: 16px;
  padding: 12px;
  background: rgba(16, 163, 127, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(16, 163, 127, 0.2);
}

.select-wrapper {
  position: relative;
}

.select-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s;
}

.select-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.15);
}

.select-arrow {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.7rem;
  pointer-events: none;
}

.input-wrapper input.readonly {
  background: rgba(64, 65, 79, 0.5);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.label-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(16, 163, 127, 0.2);
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 4px;
  vertical-align: middle;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn-secondary, .btn-primary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--accent-color);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
}


/* Tabs */
.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.02);
}

.tab-btn.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

/* File Upload */
.file-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-upload-btn {
  display: inline-block;
  padding: 8px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.file-upload-btn:hover {
  background: rgba(255,255,255,0.1);
}

.file-upload-btn input[type="file"] {
  display: none;
}

.file-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(20px) scale(0.95);
}

.divider {
  display: none; /* Hide divider since we use tabs now */
}

h3 {
  /* Hide H3 in tabs mode if redundant, or keep it */
  display: none; 
}

.input-wrapper.with-btn {
  display: flex;
  gap: 8px;
}

.small-btn {
  padding: 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.small-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

input[type="color"] {
  -webkit-appearance: none;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  background: none;
  padding: 0;
  overflow: hidden;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.color-value {
  font-family: monospace;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.range-input {
  width: 100%;
  -webkit-appearance: none;
  background: transparent;
  margin: 12px 0;
}

.range-input::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: var(--input-bg);
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: var(--accent-color);
}

.select-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s;
}

.select-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.15);
}

.select-arrow {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.7rem;
  pointer-events: none;
}

.input-wrapper input.readonly {
  background: rgba(64, 65, 79, 0.5);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.label-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(16, 163, 127, 0.2);
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 4px;
  vertical-align: middle;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn-secondary, .btn-primary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--accent-color);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
}


/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(20px) scale(0.95);
}

.divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 24px 0 16px;
}

h3 {
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 16px;
  font-weight: 600;
}

.input-wrapper.with-btn {
  display: flex;
  gap: 8px;
}

.small-btn {
  padding: 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.small-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

input[type="color"] {
  -webkit-appearance: none;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  background: none;
  padding: 0;
  overflow: hidden;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.color-value {
  font-family: monospace;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.range-input {
  width: 100%;
  -webkit-appearance: none;
  background: transparent;
  margin: 12px 0;
}

.range-input::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: var(--input-bg);
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: var(--accent-color);
  margin-top: -7px;
  cursor: pointer;
  transition: transform 0.1s;
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}
</style>