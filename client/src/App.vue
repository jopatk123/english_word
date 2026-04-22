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
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import AlarmClock from './components/AlarmClock.vue';
  import { notifyUserSessionChanged, subscribeUserSessionChanges } from './utils/authSync.js';
  import { getAuthRedirectPath, isAdminRoutePath } from './utils/authRouteAccess.js';

  const router = useRouter();
  const route = useRoute();
  const isAdminRoute = computed(() => isAdminRoutePath(route.path));
  const user = ref(null);
  let stopUserSessionSync = () => {};

  const now = ref(new Date());
  let timer = null;

  const startClock = () => {
    if (timer !== null) return;
    timer = setInterval(() => {
      now.value = new Date();
    }, 1000);
  };

  const stopClock = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  // 管理员路由不显示带时钟的 header，不需要持续计时
  watch(isAdminRoute, (isAdmin) => (isAdmin ? stopClock() : startClock()), { immediate: true });

  onUnmounted(stopClock);

  const formattedTime = computed(() =>
    now.value.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
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

  const syncUserRoute = () => {
    const redirectPath = getAuthRedirectPath(route, localStorage.getItem('token'));
    if (redirectPath) {
      router.push(redirectPath);
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
    syncUserSession();
    stopUserSessionSync = subscribeUserSessionChanges(() => {
      syncUserSession();
      syncUserRoute();
    });
  });

  onUnmounted(() => {
    stopUserSessionSync();
  });
</script>
