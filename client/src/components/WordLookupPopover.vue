<template>
  <Teleport to="body">
    <div
      v-if="state.visible"
      ref="panelRef"
      class="word-lookup-popover"
      role="dialog"
      aria-label="单词释义"
      :style="panelStyle"
      @click.stop
    >
      <div class="lookup-head">
        <strong class="lookup-word-title">{{ state.word }}</strong>
        <SpeakButton v-if="state.word" :text="state.word" />
        <button type="button" class="lookup-close" aria-label="关闭" @click="closeWordLookup">
          ×
        </button>
      </div>

      <p v-if="state.loading" class="lookup-status">正在查询…</p>
      <p v-else-if="state.error" class="lookup-error">{{ state.error }}</p>
      <template v-else-if="state.result">
        <p v-if="state.result.phonetic" class="lookup-phonetic">{{ state.result.phonetic }}</p>
        <p class="lookup-meaning">{{ state.result.meaning }}</p>
        <ul v-if="state.result.partOfSpeech?.length" class="lookup-senses">
          <li v-for="(item, index) in state.result.partOfSpeech" :key="`${item.type}-${index}`">
            <span class="lookup-pos">{{ item.type }}</span>
            {{ item.meaning }}
          </li>
        </ul>
      </template>

      <div class="lookup-actions">
        <button v-if="state.error" type="button" class="lookup-action" @click="retry">重试</button>
        <button v-if="needsAiSettings" type="button" class="lookup-action" @click="goSettings">
          去配置 AI
        </button>
        <template v-if="state.result && !state.loading">
          <button
            v-if="state.result.source === 'library' && state.result.wordId"
            type="button"
            class="lookup-action"
            @click="openDetail"
          >
            已在词库，查看
          </button>
          <button
            v-else
            type="button"
            class="lookup-action"
            :disabled="state.adding"
            @click="addLookupWordToLibrary"
          >
            {{ state.adding ? '加入中…' : '加入词库' }}
          </button>
          <button type="button" class="lookup-action" @click="openAnalysis">完整分析</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import SpeakButton from './SpeakButton.vue';
  import {
    addLookupWordToLibrary,
    closeWordLookup,
    openWordLookup,
    wordLookupState,
  } from '../composables/wordLookup.js';

  const state = wordLookupState;
  const router = useRouter();
  const route = useRoute();
  const panelRef = ref(null);
  const panelStyle = ref({ top: '0px', left: '0px' });

  const needsAiSettings = computed(() => state.error.includes('AI 配置'));

  const place = async () => {
    await nextTick();
    const anchor = state.anchor;
    const panel = panelRef.value;
    if (!state.visible || !anchor || !panel) return;
    if (!anchor.isConnected) {
      closeWordLookup();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    let top = rect.top - panelRect.height - margin;
    if (top < margin) top = rect.bottom + margin;
    const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
    let left = rect.left + rect.width / 2 - panelRect.width / 2;
    left = Math.min(Math.max(left, margin), maxLeft);
    panelStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` };
  };

  const retry = () => {
    if (!state.anchor || !state.word) return;
    openWordLookup({
      word: state.word,
      sentence: state.sentence,
      anchor: state.anchor,
    });
  };

  const goSettings = () => {
    closeWordLookup();
    router.push('/ai/settings');
  };

  const openInNewTab = (location) => {
    const href = router.resolve(location).href;
    window.open(href, '_blank', 'noopener,noreferrer');
    closeWordLookup();
  };

  const openDetail = () => {
    const wordId = state.result?.wordId;
    if (!wordId) return;
    openInNewTab(`/word/${wordId}`);
  };

  const openAnalysis = () => {
    const word = state.result?.word || state.word;
    if (!word) return;
    openInNewTab({ path: '/search', query: { q: word } });
  };

  const onPointerDown = (event) => {
    if (!state.visible) return;
    const target = event.target;
    if (panelRef.value?.contains(target)) return;
    if (state.anchor === target || state.anchor?.contains?.(target)) return;
    closeWordLookup();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && state.visible) closeWordLookup();
  };

  const onScroll = () => {
    if (state.visible) closeWordLookup();
  };

  watch(
    () => [state.visible, state.loading, state.error, state.result, state.word, state.anchor],
    () => {
      if (state.visible) place();
    }
  );

  watch(
    () => route.fullPath,
    () => closeWordLookup()
  );

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
  });
</script>

<style scoped>
  .word-lookup-popover {
    position: fixed;
    z-index: 3000;
    box-sizing: border-box;
    width: min(280px, calc(100vw - 16px));
    padding: 12px 14px;
    border: 1px solid #e4e7ed;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(31, 45, 61, 0.16);
    color: #303133;
    text-align: left;
  }

  .lookup-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lookup-word-title {
    font-size: 18px;
    line-height: 1.3;
  }

  .lookup-close {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: #909399;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }

  .lookup-status,
  .lookup-error,
  .lookup-phonetic,
  .lookup-meaning {
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .lookup-status,
  .lookup-phonetic {
    color: #909399;
    font-size: 13px;
  }

  .lookup-error {
    color: #f56c6c;
    font-size: 13px;
  }

  .lookup-meaning {
    font-size: 15px;
  }

  .lookup-senses {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .lookup-senses li {
    margin-top: 4px;
    font-size: 13px;
    line-height: 1.45;
    color: #606266;
  }

  .lookup-pos {
    display: inline-block;
    min-width: 2.4em;
    margin-right: 4px;
    color: #667eea;
    font-weight: 600;
  }

  .lookup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .lookup-action {
    border: 0;
    border-radius: 6px;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    font: inherit;
    font-size: 13px;
    line-height: 1.4;
    padding: 4px 8px;
    cursor: pointer;
  }

  .lookup-action:disabled {
    cursor: default;
    opacity: 0.6;
  }
</style>
