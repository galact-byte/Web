<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 左侧品牌区 -->
      <div class="login-decoration">
        <div class="grid-bg"></div>
        <div class="decoration-content">
          <div class="brand-mark">慎</div>
          <h1 class="brand-title">慎微</h1>
          <p class="brand-subtitle">圣人敬小慎微，动不失时</p>
          <cite class="brand-cite">——《淮南子·人间训》</cite>
          <div class="features">
            <div class="feature" style="animation-delay: 0.1s">
              <span class="feature-dot"></span>
              <span>项目全流程管控</span>
            </div>
            <div class="feature" style="animation-delay: 0.2s">
              <span class="feature-dot"></span>
              <span>多角色协同作业</span>
            </div>
            <div class="feature" style="animation-delay: 0.3s">
              <span class="feature-dot"></span>
              <span>进度实时可视化</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="login-form-container">
        <div class="form-header">
          <h2>欢迎回来</h2>
          <p>请登录您的账户继续</p>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="input-group">
            <label for="username">用户名</label>
            <input id="username" v-model="form.username" type="text" class="input" placeholder="输入用户名" required />
          </div>
          <div class="input-group">
            <label for="password">密码</label>
            <input id="password" v-model="form.password" type="password" class="input" placeholder="输入密码" required />
          </div>
          <div v-if="error" class="error-message">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="loading">
            <span v-if="loading" class="loading-spinner" style="width: 20px; height: 20px;"></span>
            <span v-else>登 录</span>
          </button>
        </form>

        <div class="form-footer">
          <p class="text-muted">账户由管理员统一分配，如需开通请联系管理员</p>
        </div>
      </div>
    </div>

    <!-- 首次登录修改密码弹窗 -->
    <div v-if="showChangePassword" class="modal-overlay">
      <div class="modal change-password-modal">
        <div class="modal-header"><h2>修改密码</h2></div>
        <div class="modal-body">
          <p class="change-password-hint">首次登录或密码已被重置，请设置新密码后继续使用。</p>
          <form @submit.prevent="handleChangePassword" class="login-form">
            <div class="input-group">
              <label for="newPassword">新密码</label>
              <input id="newPassword" v-model="newPassword" type="password" class="input" placeholder="请输入新密码（至少6位）" minlength="6" required />
            </div>
            <div class="input-group">
              <label for="confirmPassword">确认密码</label>
              <input id="confirmPassword" v-model="confirmPassword" type="password" class="input" placeholder="再次输入新密码" minlength="6" required />
            </div>
            <div v-if="changePasswordError" class="error-message">{{ changePasswordError }}</div>
            <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="changingPassword">
              <span v-if="changingPassword" class="loading-spinner" style="width: 20px; height: 20px;"></span>
              <span v-else>确认修改</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const error = ref('')
const showChangePassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const changePasswordError = ref('')
const changingPassword = ref(false)

const form = reactive({
  username: '',
  password: ''
})

async function handleSubmit() {
  loading.value = true
  error.value = ''

  try {
    const user = await userStore.login({
      username: form.username,
      password: form.password
    })
    if (user.must_change_password) {
      showChangePassword.value = true
    } else {
      router.push('/')
    }
  } catch (err) {
    error.value = err.response?.data?.detail || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

async function handleChangePassword() {
  changePasswordError.value = ''

  if (newPassword.value.length < 6) {
    changePasswordError.value = '密码长度不能少于6位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    changePasswordError.value = '两次输入的密码不一致'
    return
  }

  changingPassword.value = true
  try {
    await userStore.changePassword(newPassword.value)
    showChangePassword.value = false
    router.push('/')
  } catch (err) {
    changePasswordError.value = err.response?.data?.detail || '密码修改失败，请重试'
  } finally {
    changingPassword.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg-primary);
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 960px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  animation: containerIn 0.5s ease;
}
@keyframes containerIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 左侧品牌区 */
.login-decoration {
  flex: 1;
  background: #080f0f;
  padding: 3rem 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(0, 212, 170, 0.12) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.5;
}

.login-decoration::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 70%, rgba(0, 212, 170, 0.1) 0%, transparent 60%);
  pointer-events: none;
}

[data-theme="light"] .login-decoration { background: #f0f7f6; }
[data-theme="light"] .grid-bg {
  background-image: radial-gradient(circle, rgba(8, 145, 178, 0.1) 1px, transparent 1px);
}
[data-theme="light"] .login-decoration::after {
  background: radial-gradient(ellipse at 30% 70%, rgba(8, 145, 178, 0.06) 0%, transparent 60%);
}

.decoration-content {
  position: relative;
  z-index: 1;
  text-align: center;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border: 2px solid var(--accent-primary);
  border-radius: 50%;
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: 1.25rem;
  animation: markPulse 3s ease-in-out infinite;
}
@keyframes markPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 170, 0.2); }
  50% { box-shadow: 0 0 0 12px rgba(0, 212, 170, 0); }
}

.brand-title {
  font-family: 'DM Serif Display', serif;
  font-size: 2.2rem;
  font-weight: 400;
  color: #e0f2f1;
  margin-bottom: 0.5rem;
  letter-spacing: 0.15em;
}
[data-theme="light"] .brand-title { color: var(--text-primary); }

.brand-subtitle {
  color: #80cbc4;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  font-style: italic;
}
[data-theme="light"] .brand-subtitle { color: var(--text-secondary); }

.brand-cite {
  display: block;
  color: #4db6ac;
  font-size: 0.8rem;
  margin-bottom: 2rem;
  font-style: normal;
}
[data-theme="light"] .brand-cite { color: var(--text-muted); }

.features {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.875rem;
  color: #b2dfdb;
  font-size: 0.9rem;
  opacity: 0;
  animation: featureIn 0.4s ease forwards;
}
@keyframes featureIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
[data-theme="light"] .feature { color: var(--text-primary); }

.feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  flex-shrink: 0;
}

/* 右侧表单 */
.login-form-container {
  flex: 1;
  padding: 3rem 2.5rem;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-header { margin-bottom: 1.75rem; }
.form-header h2 {
  font-family: 'DM Serif Display', serif;
  font-size: 1.6rem;
  font-weight: 400;
  margin-bottom: 0.375rem;
}
.form-header p { color: var(--text-secondary); font-size: 0.9rem; }

.login-form { display: flex; flex-direction: column; gap: 1.125rem; }

.error-message {
  padding: 0.625rem 0.875rem;
  background: var(--error-bg);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 0.85rem;
}

.form-footer { margin-top: 1.25rem; text-align: center; font-size: 0.85rem; }

.change-password-modal { max-width: 400px; width: 90%; }
.change-password-hint {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-size: 0.85rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .login-container { flex-direction: column; }
  .login-decoration { padding: 2rem 1.5rem; }
  .brand-title { font-size: 1.8rem; }
  .features { display: none; }
}
</style>
