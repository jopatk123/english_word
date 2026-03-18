<template>
  <div class="session-progress">
    <span class="progress-text">{{ currentIndex + 1 }} / {{ total }}</span>
    <el-progress :percentage="Math.round((currentIndex / total) * 100)" :show-text="false" :stroke-width="6" />
  </div>
</template>

<script setup>
defineProps({
  currentIndex: { type: Number, required: true },
  total: { type: Number, required: true },
});
</script>
