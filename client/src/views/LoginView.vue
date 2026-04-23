<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-hero">
        <p class="login-kicker">词根记忆法</p>
        <h2 class="login-title">词根背单词工具</h2>
        <p class="login-subtitle">
          登录后继续管理词根、单词和例句，学习进度会保存在当前浏览器中。
        </p>
        <div class="login-badges">
          <span>词根管理</span>
          <span>例句整理</span>
          <span>AI 辅助</span>
        </div>
      </div>
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            @submit.prevent="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="用户名"
                prefix-icon="User"
                size="large"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                prefix-icon="Lock"
                size="large"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="login-btn"
              @click="handleLogin"
              >登录</el-button
            >
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            @submit.prevent="handleRegister"
          >
            <el-form-item prop="username">
              <el-input
                v-model="registerForm.username"
                placeholder="用户名（2-30个字符）"
                prefix-icon="User"
                size="large"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="密码（至少6位）"
                prefix-icon="Lock"
                size="large"
                show-password
              />
            </el-form-item>
            <el-form-item prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="确认密码"
                prefix-icon="Lock"
                size="large"
                show-password
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="login-btn"
              @click="handleRegister"
              >注册</el-button
            >
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
  import { notifyUserSessionChanged } from '../utils/authSync.js';
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { login, register } from '../api/index.js';
  import { showMsg } from '../utils/msg.js';

  const router = useRouter();
  const activeTab = ref('login');
  const loading = ref(false);

  // form refs for validation
  const loginForm = ref({ username: '', password: '' });
  const loginFormRef = ref(null);
  const registerForm = ref({ username: '', password: '', confirmPassword: '' });
  const registerFormRef = ref(null);

  // validation rules
  const loginRules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  };

  const validateConfirmPassword = (rule, value, callback) => {
    if (value !== registerForm.value.password) {
      callback(new Error('两次输入的密码不一致'));
    } else {
      callback();
    }
  };

  const registerRules = {
    username: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 30, message: '用户名长度需在2-30个字符', trigger: 'blur' },
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, message: '密码至少6位', trigger: 'blur' },
    ],
    confirmPassword: [
      { required: true, message: '请确认密码', trigger: 'blur' },
      { validator: validateConfirmPassword, trigger: 'blur' },
    ],
  };

  const handleLogin = async () => {
    // validate before submitting
    loginFormRef.value.validate(async (valid) => {
      if (!valid) return;
      const { username, password } = loginForm.value;
      loading.value = true;
      try {
        const res = await login({ username, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        notifyUserSessionChanged({ type: 'login' });
        showMsg('登录成功', 'success');
        router.push('/');
      } catch (e) {
        showMsg(e.response?.data?.msg || '登录失败', 'error');
      } finally {
        loading.value = false;
      }
    });
  };

  const handleRegister = async () => {
    registerFormRef.value.validate(async (valid) => {
      if (!valid) return;
      const { username, password } = registerForm.value;
      loading.value = true;
      try {
        const res = await register({ username, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        notifyUserSessionChanged({ type: 'register' });
        showMsg('注册成功', 'success');
        router.push('/');
      } catch (e) {
        showMsg(e.response?.data?.msg || '注册失败', 'error');
      } finally {
        loading.value = false;
      }
    });
  };
</script>

<style scoped>
  .login-view {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 72vh;
    padding: 32px 16px;
  }

  .login-card {
    position: relative;
    overflow: hidden;
    width: min(100%, 440px);
    padding: 32px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 28px;
    box-shadow: var(--ew-shadow);
    backdrop-filter: blur(16px);
  }

  .login-card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 6px;
    background: linear-gradient(90deg, var(--ew-brand) 0%, #0ea5e9 50%, var(--ew-accent) 100%);
  }

  .login-hero {
    margin-bottom: 24px;
    padding-top: 8px;
  }

  .login-kicker {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.08);
    color: var(--ew-brand);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .login-title {
    margin: 10px 0 8px;
    color: var(--ew-text);
    font-size: 26px;
    line-height: 1.2;
  }

  .login-subtitle {
    margin: 0;
    color: var(--ew-text-soft);
    font-size: 14px;
    line-height: 1.7;
  }

  .login-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .login-badges span {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.08);
    color: var(--ew-brand);
    font-size: 12px;
    font-weight: 600;
  }

  .login-tabs :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }

  .login-btn {
    width: 100%;
    height: 48px;
    border-radius: 14px;
  }

  .admin-link-btn {
    width: 100%;
    margin-top: 12px;
  }

  @media (max-width: 480px) {
    .login-view {
      min-height: 68vh;
      padding: 20px 12px;
    }

    .login-card {
      padding: 24px 18px;
      border-radius: 24px;
    }

    .login-title {
      font-size: 22px;
    }
  }
</style>
