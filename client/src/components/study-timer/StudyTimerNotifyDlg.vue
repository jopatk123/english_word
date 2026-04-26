<template>
  <el-dialog
    v-model="visibleModel"
    :close-on-click-modal="false"
    :show-close="false"
    append-to-body
    width="min(360px, calc(100vw - 24px))"
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
    flex-wrap: wrap;
  }
  :deep(.rest-notify-dlg .el-dialog) {
    width: min(360px, calc(100vw - 24px)) !important;
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    margin: 0;
    overflow: auto;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }
  :deep(.rest-notify-dlg .el-overlay-dialog) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  :deep(.rest-notify-dlg .el-dialog__body) {
    padding: 20px 24px 8px;
  }
  :deep(.rest-notify-dlg .el-dialog__footer) {
    padding: 0 24px 20px;
  }

  @media (max-width: 480px) {
    :deep(.rest-notify-dlg .el-dialog) {
      max-height: calc(100vh - 16px);
    }

    :deep(.rest-notify-dlg .el-overlay-dialog) {
      padding: 8px;
    }

    .rest-title {
      font-size: 18px;
    }

    .rest-msg {
      font-size: 13px;
    }

    .rest-footer {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .rest-footer :deep(.el-button) {
      width: 100%;
      margin-left: 0;
    }

    :deep(.rest-notify-dlg .el-dialog__body) {
      padding: 18px 16px 6px;
    }

    :deep(.rest-notify-dlg .el-dialog__footer) {
      padding: 0 16px 16px;
    }
  }
</style>
