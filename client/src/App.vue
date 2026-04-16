<template>
  <router-view v-if="isAdminRoute" />
  <div v-else class="app-container">
    <el-header class="app-header">
      <div class="header-content" @click="$router.push('/')">
      </div>
      <div class="header-clock">{{ formattedTime }}</div>
      <div v-if="user" class="header-nav">
        <el-button class="nav-btn" link @click="$router.push('/search')">🔍 搜索</el-button>
        <el-button class="nav-btn" link @click="$router.push('/')">📚 学单词</el-button>
        <el-button class="nav-btn" link @click="$router.push('/study')">📝 背单词</el-button>
        <el-button class="nav-btn" link @click="$router.push('/ai/settings')">🤖 AI 配置</el-button>
        <AlarmClock class="header-alarm" />
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
  import { ref, watchEffect, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import AlarmClock from './components/AlarmClock.vue';
  import { notifyUserSessionChanged, subscribeUserSessionChanges } from './utils/authSync.js';

  const router = useRouter();
  const route = useRoute();
  const isAdminRoute = computed(() => route.path.startsWith('/super-admin'));
  const user = ref(null);
  let stopUserSessionSync = () => {};

  const now = ref(new Date());
  const timer = setInterval(() => {
    now.value = new Date();
  }, 1000);

  onUnmounted(() => {
    clearInterval(timer);
  });

  const formattedTime = computed(() =>
    now.value.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  const syncUserSession = () => {
    try {
      const raw = localStorage.getItem('user');
      user.value = raw ? JSON.parse(raw) : null;
    } catch {
      user.value = null;
    }
  };

  watchEffect(() => {
    // Re-evaluate on route change to pick up login/logout
    void route.path;
    syncUserSession();
  });

  const syncUserRoute = () => {
    const hasToken = Boolean(localStorage.getItem('token'));
    if (!hasToken && !route.meta.guest && !isAdminRoute.value) {
      router.push('/login');
      return;
    }

    if (hasToken && route.meta.guest) {
      router.push('/');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    notifyUserSessionChanged({ type: 'logout' });
    user.value = null;
    router.push('/login');
  };

  onMounted(() => {
    stopUserSessionSync = subscribeUserSessionChanges(() => {
      syncUserSession();
      syncUserRoute();
    });
  });

  onUnmounted(() => {
    stopUserSessionSync();
  });
</script>
