<template>
  <div ref="rootRef" class="passage-text">
    <p
      v-for="(paragraph, paragraphIndex) in paragraphs"
      :key="paragraphIndex"
      class="passage-paragraph"
    >
      <span
        v-for="sentence in paragraph"
        :key="sentence.id"
        class="passage-sentence"
        :class="{
          'is-active': sentence.id === activeSentenceId,
          'is-revealed': isTranslationVisible(sentence),
        }"
        :data-sentence-id="sentence.id"
      >
        <ClickableSentence
          :text="sentence.text"
          :word-class="wordClass"
          :lookup-context="contextFor(sentence)"
        />
        <span class="passage-sentence-tools">
          <button
            type="button"
            class="passage-sentence-tool"
            :class="{ 'is-on': isTranslationVisible(sentence) }"
            :aria-label="isTranslationVisible(sentence) ? '隐藏这句译文' : '显示这句译文'"
            @click="$emit('toggle-translation', sentence.id)"
          >
            译
          </button>
          <button
            type="button"
            class="passage-sentence-tool"
            aria-label="只读这一句"
            @click="$emit('play-sentence', sentence.orderIndex)"
          >
            ▶
          </button>
        </span>
        <span v-if="isTranslationVisible(sentence)" class="passage-sentence-translation">
          <span :class="{ 'is-empty': !sentence.translation }">
            {{ sentence.translation || '暂无译文' }}
          </span>
          <button
            type="button"
            class="passage-translation-edit"
            @click="$emit('edit-translation', sentence)"
          >
            {{ sentence.translation ? '修改' : '填写' }}
          </button>
        </span>
      </span>
    </p>
  </div>
</template>

<script setup>
  import { computed, nextTick, ref, watch } from 'vue';
  import ClickableSentence from '../ClickableSentence.vue';
  import { groupSentencesByParagraph } from '../../utils/passageText.js';

  const props = defineProps({
    passageId: { type: Number, required: true },
    sentences: { type: Array, default: () => [] },
    showAllTranslations: { type: Boolean, default: false },
    revealedIds: { type: Object, default: () => ({}) },
    activeSentenceId: { type: Number, default: null },
    wordClass: { type: Function, default: null },
    wordAddedHandler: { type: Function, default: null },
  });

  defineEmits(['toggle-translation', 'play-sentence', 'edit-translation']);

  const rootRef = ref(null);
  const paragraphs = computed(() => groupSentencesByParagraph(props.sentences));

  const isTranslationVisible = (sentence) =>
    props.showAllTranslations
      ? props.revealedIds[sentence.id] !== false
      : props.revealedIds[sentence.id] === true;

  const contextFor = (sentence) => ({
    passageId: props.passageId,
    sentenceId: sentence.id,
    onAdded: props.wordAddedHandler,
  });

  // 朗读到屏幕外的句子时滚动到可见区域
  watch(
    () => props.activeSentenceId,
    async (id) => {
      if (id === null) return;
      await nextTick();
      const element = rootRef.value?.querySelector(`[data-sentence-id="${id}"]`);
      if (!element?.getBoundingClientRect) return;
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < 80 || rect.bottom > viewportHeight - 140) {
        element.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
    }
  );
</script>
