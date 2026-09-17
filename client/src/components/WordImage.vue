<template>
  <div v-if="hasImage" class="word-image-frame" :class="variantClass">
    <div v-if="loading" class="word-image-status">正在加载记忆图片…</div>
    <div v-else-if="loadError" class="word-image-status is-error">{{ loadError }}</div>
    <img
      v-else-if="objectUrl"
      :src="objectUrl"
      :alt="alt"
      class="word-memory-image"
      draggable="false"
    />
  </div>
</template>

<script setup>
  import { computed } from 'vue';
  import { useWordImage } from '../composables/useWordImage.js';

  const props = defineProps({
    wordId: { type: [Number, String], required: true },
    hasImage: { type: Boolean, default: false },
    alt: { type: String, default: '单词记忆图片' },
    variant: { type: String, default: 'card' },
  });

  const { objectUrl, loading, loadError } = useWordImage(
    () => props.wordId,
    () => props.hasImage
  );

  const variantClass = computed(() => (props.variant === 'study' ? 'is-study' : 'is-detail'));
</script>
