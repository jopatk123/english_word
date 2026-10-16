<template>
  <span class="clickable-sentence">
    <template v-for="(token, index) in tokens" :key="index">
      <button
        v-if="token.word"
        type="button"
        class="lookup-word"
        :class="[{ 'is-active': isActive(token.word) }, wordClass?.(token.word)]"
        :aria-label="`查询 ${token.word}`"
        @click.stop="onLookup(token.word, $event)"
      >
        {{ token.text }}
      </button>
      <span v-else>{{ token.text }}</span>
    </template>
  </span>
</template>

<script setup>
  import { computed } from 'vue';
  import { openWordLookup, wordLookupState } from '../composables/wordLookup.js';
  import { tokenizeSentence } from '../utils/sentenceTokens.js';

  const props = defineProps({
    text: { type: String, default: '' },
    // 按单词返回额外的 class，例如短文里按词库状态高亮
    wordClass: { type: Function, default: null },
    // 透传给查词弹窗，决定「加入词库」的去向（例如从短文加词并写例句）
    lookupContext: { type: Object, default: null },
  });

  const tokens = computed(() => tokenizeSentence(props.text));

  const isActive = (word) =>
    wordLookupState.visible &&
    wordLookupState.word === word &&
    wordLookupState.sentence === props.text;

  const onLookup = (word, event) => {
    openWordLookup({
      word,
      sentence: props.text,
      anchor: event.currentTarget,
      context: props.lookupContext,
    });
  };
</script>

<style scoped>
  .clickable-sentence {
    white-space: inherit;
  }

  .lookup-word {
    display: inline;
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px dashed transparent;
    background: none;
    color: inherit;
    font: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    cursor: pointer;
    border-radius: 2px;
  }

  .lookup-word:hover,
  .lookup-word:focus-visible,
  .lookup-word.is-active {
    color: #667eea;
    border-bottom-color: currentColor;
  }

  .lookup-word:focus-visible {
    outline: 2px solid #667eea;
    outline-offset: 1px;
  }
</style>
