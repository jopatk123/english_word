<template>
  <nav v-show="visible" class="mobile-tabbar" aria-label="主导航">
    <button
      type="button"
      class="mobile-tab"
      :class="{ active: active === 'home' }"
      @click="$emit('select', 'home')"
    >
      <span class="mobile-tab-icon" aria-hidden="true">📚</span>
      <span>学单词</span>
    </button>
    <button
      type="button"
      class="mobile-tab"
      :class="{ active: active === 'study' }"
      @click="$emit('select', 'study')"
    >
      <span class="mobile-tab-icon" aria-hidden="true">📝</span>
      <span>背单词</span>
    </button>
    <button
      type="button"
      class="mobile-tab"
      :class="{ active: active === 'search' }"
      @click="$emit('select', 'search')"
    >
      <span class="mobile-tab-icon" aria-hidden="true">🔍</span>
      <span>搜索</span>
    </button>
    <button
      type="button"
      class="mobile-tab"
      :class="{ active: active === 'more' || moreOpen }"
      @click="$emit('select', 'more')"
    >
      <span class="mobile-tab-icon" aria-hidden="true">☰</span>
      <span>更多</span>
    </button>
  </nav>

  <Teleport to="body">
    <div v-if="moreOpen && visible" class="more-sheet-overlay" @click.self="$emit('close-more')">
      <div class="more-sheet" role="dialog" aria-label="更多">
        <div class="more-sheet-handle" />
        <p v-if="username" class="more-sheet-user">{{ username }}</p>
        <button type="button" class="more-sheet-item" @click="$emit('navigate', '/ai/settings')">
          🤖 AI 配置
        </button>
        <button
          type="button"
          class="more-sheet-item"
          @click="$emit('navigate', '/settings/api-tokens')"
        >
          🔑 API Token
        </button>
        <button type="button" class="more-sheet-item more-sheet-danger" @click="$emit('logout')">
          退出登录
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
  defineProps({
    visible: { type: Boolean, default: true },
    active: { type: String, default: 'home' },
    moreOpen: { type: Boolean, default: false },
    username: { type: String, default: '' },
  });

  defineEmits(['select', 'navigate', 'logout', 'close-more']);
</script>
