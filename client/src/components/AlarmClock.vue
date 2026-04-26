<template>
  <div class="alarm-wrapper">
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
    <Teleport to="body">
      <transition name="alarm-panel-fade">
        <div v-if="panelVisible" class="alarm-panel-overlay" @click.self="panelVisible = false">
          <div class="alarm-panel-wrapper">
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
              :saved-total-seconds="savedTotalSeconds"
              :action-pending="actionPending"
              @start="handleStart"
              @stop="handleStop"
              @close="panelVisible = false"
              @update:alarm-enabled="alarmEnabled = $event"
              @update:alarm-minutes="alarmMinutes = $event"
            />
          </div>
        </div>
      </transition>
    </Teleport>

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
  import { ref } from 'vue';
  import { useStudyTimer } from '../composables/useStudyTimer.js';
  import StudyTimerPanel from './study-timer/StudyTimerPanel.vue';
  import StudyTimerNotifyDlg from './study-timer/StudyTimerNotifyDlg.vue';

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
    savedTotalSeconds,
    restNotifyVisible,
    actionPending,
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

  .alarm-panel-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.22);
    backdrop-filter: blur(4px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .alarm-panel-wrapper {
    position: relative;
    z-index: 9999;
    margin: auto;
    max-width: 100%;
  }

  .alarm-panel-fade-enter-active,
  .alarm-panel-fade-leave-active {
    transition: opacity 0.22s, transform 0.22s;
  }

  .alarm-panel-fade-enter-from,
  .alarm-panel-fade-leave-to {
    opacity: 0;
    transform: scale(0.97);
  }

  @media (max-width: 768px) {
    .alarm-panel-overlay {
      padding: 12px;
      align-items: center;
    }

    .alarm-badge {
      display: none;
    }
  }
</style>
