<template>
  <div class="session-progress">
    <span class="progress-text">{{ displayIndex }} / {{ total }}</span>
    <div class="progress-track">
      <el-progress :percentage="percentage" :show-text="false" :stroke-width="6" />
      <input
        v-if="canSeek"
        class="progress-seek"
        type="range"
        :min="1"
        :max="total"
        :value="displayIndex"
        :aria-label="`跳转到第 ${displayIndex} 个单词`"
        @input="handleSeek"
      />
    </div>
  </div>
</template>

<script setup>
  import { computed } from 'vue';

  const props = defineProps({
    currentIndex: { type: Number, required: true },
    total: { type: Number, required: true },
  });

  const emit = defineEmits(['seek']);

  const displayIndex = computed(() => {
    if (props.total <= 0) return 0;
    return Math.min(Math.max(props.currentIndex + 1, 1), props.total);
  });

  const percentage = computed(() => {
    if (props.total <= 0) return 0;
    return Math.round((displayIndex.value / props.total) * 100);
  });

  const canSeek = computed(() => props.total > 1);

  const handleSeek = (event) => {
    const nextIndex = Number(event.target.value) - 1;
    emit('seek', nextIndex);
  };
</script>
