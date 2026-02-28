<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 左侧装饰 -->
      <div class="login-decoration">
        <div class="decoration-content">
          <div class="logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h1>项目完结单管理平台</h1>
          <p>高效管理项目完结单，实现数据一键导出</p>
          <div class="features">
            <div class="feature">
              <span class="feature-icon">📋</span>
              <span>项目录入与分发</span>
            </div>
            <div class="feature">
              <span class="feature-icon">👥</span>
              <span>多角色协作管理</span>
            </div>
            <div class="feature">
              <span class="feature-icon">📊</span>
              <span>Excel/Word 导出</span>
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
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="input"
              placeholder="输入用户名"
              required
            />
          </div>

          <div class="input-group">
            <label for="password">密码</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="input"
              placeholder="输入密码"
              required
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

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
        <div class="modal-header">
          <h2>🔐 修改密码</h2>
        </div>
        <div class="modal-body">
          <p class="change-password-hint">首次登录或密码已被重置，请设置新密码后继续使用。</p>
          <form @submit.prevent="handleChangePassword" class="login-form">
            <div class="input-group">
              <label for="newPassword">新密码</label>
              <input
                id="newPassword"
                v-model="newPassword"
                type="password"
                class="input"
                placeholder="请输入新密码（至少6位）"
                minlength="6"
                required
              />
            </div>
            <div class="input-group">
              <label for="confirmPassword">确认密码</label>
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                class="input"
                placeholder="再次输入新密码"
                minlength="6"
                required
              />
            </div>
            <div v-if="changePasswordError" class="error-message">
              {{ changePasswordError }}
            </div>
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
    // 检查是否需要修改密码
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
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

/* 左侧装饰 */
.login-decoration {
  flex: 1;
  background: var(--accent-gradient);
  padding: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-decoration::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

.decoration-content {
  position: relative;
  z-index: 1;
  color: white;
  text-align: center;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
}

.decoration-content h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.decoration-content p {
  opacity: 0.9;
  margin-bottom: 2rem;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  backdrop-filter: blur(10px);
}

.feature-icon {
  font-size: 1.25rem;
}

/* 右侧表单 */
.login-form-container {
  flex: 1;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-header {
  margin-bottom: 2rem;
}

.form-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.form-header p {
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.error-message {
  padding: 0.75rem 1rem;
  background: var(--error-bg);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 0.9rem;
}

.form-footer {
  margin-top: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
}

/* 修改密码弹窗 */
.change-password-modal {
  max-width: 420px;
  width: 90%;
}

.change-password-hint {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* 响应式 */
@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
  }

  .login-decoration {
    padding: 2rem;
  }

  .decoration-content h1 {
    font-size: 1.5rem;
  }

  .features {
    display: none;
  }
}
</style>
