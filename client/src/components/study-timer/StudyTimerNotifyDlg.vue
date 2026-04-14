<template>
  <el-dialog
    v-model="visibleModel"
    :close-on-click-modal="false"
    :show-close="false"
    width="360px"
    align-center
    class="rest-notify-dlg"
  >
    <div class="rest-notify-body">
      <div class="rest-icon">☕</div>
      <p class="rest-title">该休息一下了！</p>
      <p class="rest-msg">
        你已持续学习 <strong>{{ alarmMinutes }} 分钟</strong>，让眼睛和大脑放松一下吧
      </p>
    </div>
    <template #footer>
      <div class="rest-footer">
        <el-button @click="emit('continue')">继续学习</el-button>
        <el-button type="primary" @click="emit('stop')">停止计时</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
  import { computed } from 'vue';

  const props = defineProps({
    visible: Boolean,
    alarmMinutes: { type: Number, default: 30 },
  });
  const emit = defineEmits(['update:visible', 'continue', 'stop']);

  const visibleModel = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
  });
</script>

<style scoped>
  .rest-notify-body {
    text-align: center;
    padding: 12px 0 4px;
  }
  .rest-icon {
    font-size: 56px;
    margin-bottom: 12px;
  }
  .rest-title {
    font-size: 20px;
    font-weight: 700;
    color: #333;
    margin: 0 0 8px;
  }
  .rest-msg {
    font-size: 14px;
    color: #666;
    margin: 0;
    line-height: 1.6;
  }
  .rest-footer {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  :deep(.rest-notify-dlg .el-dialog__footer) {
    padding: 0 24px 20px;
  }
</style>
