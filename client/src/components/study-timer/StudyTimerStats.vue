<template>
  <div class="stats-block">
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ formatSecondsToText(todaySeconds) }}</span>
        <span class="stat-label">今日学习</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value total">{{ formatSecondsToText(totalSeconds) }}</span>
        <span class="stat-label">累计总时长</span>
      </div>
    </div>
    <button class="export-btn" :disabled="!savedTotalSeconds" @click="handleExport" title="下载学习记录">
      ⬇ 下载记录
    </button>
  </div>
</template>

<script setup>
import { exportStudySessions } from '../../api/index.js';
import { ElMessage } from 'element-plus';

defineProps({
  todaySeconds: { type: Number, default: 0 },
  totalSeconds: { type: Number, default: 0 },
  savedTotalSeconds: { type: Number, default: 0 },
});

function formatSecondsToText(s) {
  if (!s) return '0分钟';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}小时${m}分`;
  if (h > 0) return `${h}小时`;
  return `${m || 1}分钟`;
}

async function handleExport() {
  try {
    const blob = await exportStudySessions();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    ElMessage.error('导出失败，请重试');
  }
}
</script>

<style scoped>
.stats-block {
  border-top: 1px solid #f0f0f0;
  padding: 12px 16px 4px;
}
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 10px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #667eea;
}
.stat-value.total {
  color: #764ba2;
}
.stat-label {
  font-size: 11px;
  color: #aaa;
  letter-spacing: 0.3px;
}
.stat-divider {
  width: 1px;
  height: 30px;
  background: #f0f0f0;
}
.export-btn {
  width: 100%;
  padding: 7px;
  background: #f5f5f5;
  color: #888;
  border: 1.5px solid #e8e8e8;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}
.export-btn:not(:disabled):hover {
  background: #eef0ff;
  color: #667eea;
  border-color: #c5caff;
}
.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
