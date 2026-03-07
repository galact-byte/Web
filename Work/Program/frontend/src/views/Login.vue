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
              <span class="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </span>
              <span>项目录入与分发</span>
            </div>
            <div class="feature">
              <span class="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </span>
              <span>多角色协作管理</span>
            </div>
            <div class="feature">
              <span class="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </span>
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
          <h2>修改密码</h2>
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
  background: var(--bg-primary);
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 960px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

/* 左侧品牌区 */
.login-decoration {
  flex: 1;
  background: #0c1c1c;
  padding: 3rem 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-decoration::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 80%, rgba(0, 212, 170, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 20%, rgba(255, 107, 157, 0.06) 0%, transparent 55%);
  pointer-events: none;
}

[data-theme="light"] .login-decoration {
  background: #f0fdfb;
}
[data-theme="light"] .login-decoration::before {
  background:
    radial-gradient(ellipse at 20% 80%, rgba(8, 145, 178, 0.08) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 20%, rgba(217, 119, 6, 0.05) 0%, transparent 55%);
}

.decoration-content {
  position: relative;
  z-index: 1;
  text-align: center;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
}

.decoration-content h1 {
  font-family: 'DM Serif Display', serif;
  font-size: 1.6rem;
  font-weight: 400;
  color: #e0f2f1;
  margin-bottom: 0.375rem;
}
[data-theme="light"] .decoration-content h1 {
  color: var(--text-primary);
}

.decoration-content p {
  color: #80cbc4;
  font-size: 0.9rem;
  margin-bottom: 2rem;
}
[data-theme="light"] .decoration-content p {
  color: var(--text-secondary);
}

.features {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  text-align: left;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid rgba(0, 212, 170, 0.2);
  border-radius: var(--radius-md);
  background: rgba(0, 212, 170, 0.05);
  color: #b2dfdb;
  font-size: 0.9rem;
  transition: border-color var(--transition-normal);
}
.feature:hover { border-color: rgba(0, 212, 170, 0.4); }

[data-theme="light"] .feature {
  border-color: rgba(8, 145, 178, 0.15);
  background: rgba(8, 145, 178, 0.04);
  color: var(--text-primary);
}
[data-theme="light"] .feature:hover { border-color: rgba(8, 145, 178, 0.35); }

.feature-icon {
  display: flex;
  align-items: center;
  color: var(--accent-primary);
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

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.error-message {
  padding: 0.625rem 0.875rem;
  background: var(--error-bg);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 0.85rem;
}

.form-footer {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.85rem;
}

/* 修改密码弹窗 */
.change-password-modal { max-width: 400px; width: 90%; }
.change-password-hint {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-size: 0.85rem;
  line-height: 1.5;
}

/* 响应式 */
@media (max-width: 768px) {
  .login-container { flex-direction: column; }
  .login-decoration { padding: 2rem 1.5rem; }
  .decoration-content h1 { font-size: 1.4rem; }
  .features { display: none; }
}
</style>
