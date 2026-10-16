<template>
  <div class="passage-player" role="toolbar" aria-label="听读控制">
    <span class="passage-player-progress">
      {{ currentIndex >= 0 ? `第 ${currentIndex + 1} / ${total} 句` : `共 ${total} 句` }}
    </span>
    <div class="passage-player-controls">
      <button type="button" class="passage-player-btn" aria-label="上一句" @click="$emit('prev')">
        ⏮
      </button>
      <button
        type="button"
        class="passage-player-btn is-primary"
        :aria-label="playing ? '暂停' : '播放'"
        @click="$emit('toggle')"
      >
        {{ playing ? '⏸' : '▶' }}
      </button>
      <button type="button" class="passage-player-btn" aria-label="下一句" @click="$emit('next')">
        ⏭
      </button>
      <button
        type="button"
        class="passage-player-btn"
        :class="{ 'is-on': loop }"
        :aria-pressed="loop"
        aria-label="单句循环"
        @click="$emit('toggle-loop')"
      >
        🔁
      </button>
    </div>
    <div class="passage-player-rates" role="group" aria-label="语速">
      <button
        v-for="option in PASSAGE_SPEECH_RATES"
        :key="option.value"
        type="button"
        class="passage-player-rate"
        :class="{ 'is-on': option.value === rate }"
        @click="$emit('update-rate', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <button type="button" class="passage-player-close" aria-label="关闭听读" @click="$emit('close')">
      ×
    </button>
  </div>
</template>

<script setup>
  import { PASSAGE_SPEECH_RATES } from '../../constants/passage.js';

  defineProps({
    playing: { type: Boolean, default: false },
    loop: { type: Boolean, default: false },
    rate: { type: Number, required: true },
    currentIndex: { type: Number, default: -1 },
    total: { type: Number, default: 0 },
  });

  defineEmits(['toggle', 'prev', 'next', 'toggle-loop', 'update-rate', 'close']);
</script>
