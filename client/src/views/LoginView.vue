<template>
  <div class="login-view">
    <div class="login-card">
      <h2 class="login-title">📖 词根背单词</h2>
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" @submit.prevent="handleLogin">
            <el-form-item>
              <el-input v-model="loginForm.username" placeholder="用户名" prefix-icon="User" size="large" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="loginForm.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleLogin" />
            </el-form-item>
            <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">登录</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" @submit.prevent="handleRegister">
            <el-form-item>
              <el-input v-model="registerForm.username" placeholder="用户名（2-30个字符）" prefix-icon="User" size="large" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="registerForm.password" type="password" placeholder="密码（至少6位）" prefix-icon="Lock" size="large" show-password />
            </el-form-item>
            <el-form-item>
              <el-input v-model="registerForm.confirmPassword" type="password" placeholder="确认密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleRegister" />
            </el-form-item>
            <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleRegister">注册</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { login, register } from '../api/index.js';

const router = useRouter();
const activeTab = ref('login');
const loading = ref(false);
const loginForm = ref({ username: '', password: '' });
const registerForm = ref({ username: '', password: '', confirmPassword: '' });

const handleLogin = async () => {
  const { username, password } = loginForm.value;
  if (!username || !password) return ElMessage.warning('请填写用户名和密码');
  loading.value = true;
  try {
    const res = await login({ username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    ElMessage.success('登录成功');
    router.push('/');
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '登录失败');
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  const { username, password, confirmPassword } = registerForm.value;
  if (!username || !password) return ElMessage.warning('请填写用户名和密码');
  if (password !== confirmPassword) return ElMessage.warning('两次输入的密码不一致');
  if (password.length < 6) return ElMessage.warning('密码至少6位');
  loading.value = true;
  try {
    const res = await register({ username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    ElMessage.success('注册成功');
    router.push('/');
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '注册失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}
.login-card {
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.login-title {
  text-align: center;
  margin-bottom: 24px;
  font-size: 24px;
}
.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}
.login-btn {
  width: 100%;
}
</style>
