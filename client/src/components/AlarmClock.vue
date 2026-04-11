<template>
  <div class="alarm-wrapper" ref="wrapperRef">
    <!-- 铃铛按钮 -->
    <button
      class="alarm-btn"
      :class="{ 'alarm-running': isRunning }"
      :title="isRunning ? `计时中: ${elapsedDisplay}` : '学习计时'"
      @click.stop="togglePanel"
    >
      <span class="alarm-bell" :class="{ lit: isRunning }">🔔</span>
      <span v-if="isRunning" class="alarm-badge">{{ elapsedDisplay }}</span>
    </button>

    <!-- 下拉面板 -->
    <transition name="alarm-panel-fade">
      <div v-if="panelVisible" class="alarm-panel-wrapper">
        <StudyTimerPanel
          :is-running="isRunning"
          :elapsed-display="elapsedDisplay"
          :alarm-enabled="alarmEnabled"
          :alarm-minutes="alarmMinutes"
          :alarm-remaining-seconds="alarmRemainingSeconds"
          :alarm-remaining-display="alarmRemainingDisplay"
          :alarm-progress-pct="alarmProgressPct"
          :today-seconds="todaySeconds"
          :total-seconds="totalSeconds"
          @start="handleStart"
          @stop="handleStop"
          @close="panelVisible = false"
          @update:alarm-enabled="alarmEnabled = $event"
          @update:alarm-minutes="alarmMinutes = $event"
        />
      </div>
    </transition>

    <!-- 休息提醒弹窗 -->
    <StudyTimerNotifyDlg
      v-model:visible="restNotifyVisible"
      :alarm-minutes="alarmMinutes"
      @continue="dismissRestAlarm"
      @stop="handleStopFromNotify"
    />
  </div>
</template>

<script setup>
  import { ref, onMounted, onUnmounted } from 'vue';
  import { useStudyTimer } from '../composables/useStudyTimer.js';
  import StudyTimerPanel from './study-timer/StudyTimerPanel.vue';
  import StudyTimerNotifyDlg from './study-timer/StudyTimerNotifyDlg.vue';

  const wrapperRef = ref(null);
  const panelVisible = ref(false);

  const {
    isRunning,
    elapsedDisplay,
    alarmEnabled,
    alarmMinutes,
    alarmRemainingSeconds,
    alarmRemainingDisplay,
    alarmProgressPct,
    todaySeconds,
    totalSeconds,
    restNotifyVisible,
    startTimer,
    stopTimer,
    dismissRestAlarm,
  } = useStudyTimer();

  function togglePanel() {
    panelVisible.value = !panelVisible.value;
  }

  async function handleStart() {
    await startTimer();
    panelVisible.value = false;
  }

  async function handleStop() {
    await stopTimer();
  }

  async function handleStopFromNotify() {
    restNotifyVisible.value = false;
    await stopTimer();
  }

  function handleOutsideClick(e) {
    if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
      panelVisible.value = false;
    }
  }

  onMounted(() => document.addEventListener('click', handleOutsideClick));
  onUnmounted(() => document.removeEventListener('click', handleOutsideClick));
</script>

<style scoped>
  .alarm-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .alarm-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 8px;
    transition: background 0.2s;
    outline: none;
  }

  .alarm-btn:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .alarm-btn.alarm-running {
    background: rgba(255, 220, 50, 0.15);
  }

  .alarm-bell {
    font-size: 18px;
    display: inline-block;
    transition: filter 0.3s;
    line-height: 1;
  }

  .alarm-bell.lit {
    filter: drop-shadow(0 0 5px rgba(102, 126, 234, 0.9));
  }

  .alarm-badge {
    background: rgba(102, 126, 234, 0.9);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    line-height: 1.4;
    white-space: nowrap;
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
  }

  .alarm-panel-wrapper {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 9999;
  }

  .alarm-panel-fade-enter-active,
  .alarm-panel-fade-leave-active {
    transition: opacity 0.22s, transform 0.22s;
  }

  .alarm-panel-fade-enter-from,
  .alarm-panel-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.97);
  }

  @media (max-width: 768px) {
    .alarm-panel-wrapper {
      right: -60px;
    }
    .alarm-badge {
      display: none;
    }
  }
</style>
