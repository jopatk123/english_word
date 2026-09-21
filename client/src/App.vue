<template>
  <router-view v-if="isAdminRoute" />
  <div
    v-else
    class="app-container"
    :class="{ 'is-study-session': isStudySession, 'is-guest': !user }"
  >
    <el-header class="app-header">
      <div class="header-shell">
        <div class="header-clock">
          <span class="clock-full">{{ formattedTime }}</span>
          <span class="clock-short">{{ formattedTimeShort }}</span>
        </div>
        <div v-if="user" class="header-nav">
          <el-button class="nav-btn" link @click="$router.push('/search')">🔍 搜索</el-button>
          <el-button class="nav-btn" link @click="$router.push('/')">📚 学单词</el-button>
          <el-button class="nav-btn" link @click="$router.push('/study')">📝 背单词</el-button>
          <el-button class="nav-btn" link @click="$router.push('/ai/settings')"
            >🤖 AI 配置</el-button
          >
          <el-button class="nav-btn" link @click="$router.push('/settings/api-tokens')"
            >🔑 Token</el-button
          >
          <AlarmClock class="header-alarm" />
          <div class="header-user">
            <span class="username">{{ user.username }}</span>
            <el-button link @click="handleLogout">退出</el-button>
          </div>
        </div>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
    <WordLookupPopover />
    <AppMobileNav
      :visible="Boolean(user) && !isStudySession"
      :active="activeTab"
      :more-open="moreOpen"
      :username="user?.username || ''"
      @select="onMobileTabSelect"
      @navigate="onMoreNavigate"
      @logout="handleLogout"
      @close-more="moreOpen = false"
    />
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import AlarmClock from './components/AlarmClock.vue';
  import AppMobileNav from './components/AppMobileNav.vue';
  import WordLookupPopover from './components/WordLookupPopover.vue';
  import { clearWordLookupSession } from './composables/wordLookup.js';
  import { notifyUserSessionChanged, subscribeUserSessionChanges } from './utils/authSync.js';
  import { clearAiSettingsServerState } from './utils/aiSettings.js';
  import { getAuthRedirectPath, isAdminRoutePath } from './utils/authRouteAccess.js';

  const router = useRouter();
  const route = useRoute();
  const isAdminRoute = computed(() => isAdminRoutePath(route.path));
  const isStudySession = computed(() => route.path === '/study/session');
  const user = ref(null);
  const moreOpen = ref(false);
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

  const activeTab = computed(() => {
    const path = route.path;
    if (path.startsWith('/study')) return 'study';
    if (path.startsWith('/search')) return 'search';
    if (path.startsWith('/ai') || path.startsWith('/settings')) return 'more';
    return 'home';
  });

  const onMobileTabSelect = (id) => {
    if (id === 'more') {
      moreOpen.value = !moreOpen.value;
      return;
    }
    moreOpen.value = false;
    const target = { home: '/', study: '/study', search: '/search' }[id];
    if (target) router.push(target);
  };

  const onMoreNavigate = (path) => {
    moreOpen.value = false;
    router.push(path);
  };

  // 管理员路由不显示带时钟的 header，不需要持续计时
  watch(isAdminRoute, (isAdmin) => (isAdmin ? stopClock() : startClock()), { immediate: true });
  watch(
    () => route.path,
    () => {
      moreOpen.value = false;
    }
  );

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

  const formattedTimeShort = computed(() =>
    now.value.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
    moreOpen.value = false;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearAiSettingsServerState();
    clearWordLookupSession();
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
