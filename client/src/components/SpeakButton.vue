<template>
  <button
    class="speak-btn"
    :class="{ 'is-speaking': speakingText === text }"
    :title="speakingText === text ? '停止朗读' : '朗读'"
    @click.stop="speak(text)"
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  </button>
</template>

<script setup>
import { useSpeech } from '../utils/speech.js';

defineProps({
  text: { type: String, required: true }
});

const { speak, speakingText } = useSpeech();
</script>
