<template>
  <div class="app-container">
    <el-header class="app-header">
      <div class="header-content" @click="$router.push('/')">
        <h1 class="app-title">📖 词根背单词</h1>
      </div>
      <div v-if="user" class="header-nav">
        <el-button class="nav-btn" link @click="$router.push('/study')">📝 背单词</el-button>
        <el-button class="nav-btn" link @click="$router.push('/')">📚 学单词</el-button>
        <el-button class="nav-btn" link @click="$router.push('/ai/settings')">🤖 AI 配置</el-button>
      </div>
      <div v-if="user" class="header-user">
        <span class="username">{{ user.username }}</span>
        <el-button link @click="handleLogout">退出</el-button>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </div>
</template>

<script setup>
import { ref, watchEffect } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const user = ref(null);

watchEffect(() => {
  // Re-evaluate on route change to pick up login/logout
  void route.path;
  try {
    const raw = localStorage.getItem('user');
    user.value = raw ? JSON.parse(raw) : null;
  } catch {
    user.value = null;
  }
});

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user.value = null;
  router.push('/login');
};
</script>
