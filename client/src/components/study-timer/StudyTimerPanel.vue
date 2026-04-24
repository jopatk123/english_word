<template>
  <div class="st-panel" @click.stop>
    <!-- 标题栏 -->
    <div class="stp-header">
      <span class="stp-title">⏱ 学习计时</span>
      <button class="stp-close" @click="emit('close')" title="关闭">×</button>
    </div>

    <!-- 计时大屏 -->
    <div class="stp-timer-area">
      <div class="stp-elapsed" :class="{ running: isRunning }">
        {{ elapsedDisplay }}
      </div>
      <div class="stp-sub" v-if="!isRunning">点击下方开始学习，计时自动记录</div>
      <div class="stp-sub" v-else>学习计时中 · 点击停止保存记录</div>
    </div>

    <!-- 开始 / 停止 按钮 -->
    <div class="stp-actions">
      <button v-if="!isRunning" class="stp-btn-start" :disabled="actionPending" @click="emit('start')">
        {{ actionPending ? '处理中...' : '▶ 开始学习' }}
      </button>
      <button v-else class="stp-btn-stop" :disabled="actionPending" @click="emit('stop')">
        {{ actionPending ? '处理中...' : '■ 停止计时' }}
      </button>
    </div>

    <!-- 休息提醒设置（仅未开始时可调整） -->
    <div class="stp-alarm-section">
      <div class="stp-alarm-header">
        <label class="stp-alarm-label">
          <input
            type="checkbox"
            v-model="alarmEnabledModel"
            :disabled="isRunning || actionPending"
            class="stp-checkbox"
          />
          <span>学习 {{ alarmMinutesModel }} 分钟后提醒休息</span>
        </label>
      </div>
      <template v-if="alarmEnabledModel">
        <!-- 快捷时长选项 -->
        <div class="stp-presets" v-if="!isRunning">
          <button
            v-for="p in presets"
            :key="p"
            class="stp-preset"
            :class="{ active: alarmMinutesModel === p }"
            :disabled="actionPending"
            @click="alarmMinutesModel = p"
          >
            {{ p }}分钟
          </button>
        </div>
        <!-- 倒计时进度条（运行时显示） -->
        <div v-if="isRunning && alarmRemainingSeconds !== null" class="stp-alarm-progress">
          <div class="stp-alarm-progress-bar">
            <div class="stp-alarm-progress-fill" :style="{ width: alarmProgressPct + '%' }"></div>
          </div>
          <span class="stp-alarm-remain">{{ alarmRemainingDisplay }} 后提醒休息</span>
        </div>
      </template>
    </div>

    <!-- 统计区 -->
    <StudyTimerStats
      :today-seconds="todaySeconds"
      :total-seconds="totalSeconds"
      :saved-total-seconds="savedTotalSeconds"
    />
  </div>
</template>

<script setup>
  import { computed } from 'vue';
  import StudyTimerStats from './StudyTimerStats.vue';

  const props = defineProps({
    isRunning: Boolean,
    elapsedDisplay: { type: String, default: '00:00' },
    alarmEnabled: Boolean,
    alarmMinutes: { type: Number, default: 30 },
    alarmRemainingSeconds: { type: Number, default: null },
    alarmRemainingDisplay: { type: String, default: '' },
    alarmProgressPct: { type: Number, default: 0 },
    todaySeconds: { type: Number, default: 0 },
    totalSeconds: { type: Number, default: 0 },
    savedTotalSeconds: { type: Number, default: 0 },
    actionPending: Boolean,
  });

  const emit = defineEmits([
    'start',
    'stop',
    'close',
    'update:alarmEnabled',
    'update:alarmMinutes',
  ]);

  const presets = [15, 30, 45, 60];

  const alarmEnabledModel = computed({
    get: () => props.alarmEnabled,
    set: (v) => emit('update:alarmEnabled', v),
  });

  const alarmMinutesModel = computed({
    get: () => props.alarmMinutes,
    set: (v) => emit('update:alarmMinutes', v),
  });
</script>

<style scoped>
  .st-panel {
    width: min(300px, calc(100vw - 16px));
    background: #fff;
    border-radius: 14px;
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.18),
      0 2px 10px rgba(0, 0, 0, 0.1);
    color: #333;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* 标题栏 */
  .stp-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stp-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .stp-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0 2px;
    border-radius: 4px;
    transition: color 0.15s;
  }
  .stp-close:hover {
    color: #fff;
  }

  /* 大计时器 */
  .stp-timer-area {
    padding: 20px 16px 8px;
    text-align: center;
  }
  .stp-elapsed {
    font-size: 52px;
    font-weight: 800;
    letter-spacing: 4px;
    font-variant-numeric: tabular-nums;
    color: #ccc;
    line-height: 1.1;
    transition: color 0.3s;
  }
  .stp-elapsed.running {
    color: #667eea;
    text-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
  }
  .stp-sub {
    font-size: 12px;
    color: #bbb;
    margin-top: 6px;
    letter-spacing: 0.3px;
  }

  /* 操作按钮 */
  .stp-actions {
    padding: 10px 16px;
  }
  .stp-btn-start {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    letter-spacing: 0.5px;
    outline: none;
  }
  .stp-btn-start:hover {
    opacity: 0.9;
  }

  .stp-btn-start:disabled,
  .stp-btn-stop:disabled,
  .stp-preset:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .stp-btn-stop {
    width: 100%;
    padding: 12px;
    background: #ff6b6b;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    outline: none;
  }
  .stp-btn-stop:hover {
    background: #e85555;
  }

  /* 休息提醒 */
  .stp-alarm-section {
    padding: 0 16px 12px;
    border-top: 1px solid #f5f5f5;
    margin-top: 4px;
    padding-top: 12px;
  }
  .stp-alarm-header {
    display: flex;
    align-items: center;
  }
  .stp-alarm-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: #555;
    cursor: pointer;
    user-select: none;
  }
  .stp-checkbox {
    width: 15px;
    height: 15px;
    accent-color: #667eea;
    cursor: pointer;
  }
  .stp-alarm-label input:disabled {
    cursor: not-allowed;
  }

  /* 快捷预设 */
  .stp-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .stp-preset {
    padding: 4px 10px;
    background: #f0f4ff;
    color: #667eea;
    border: 1.5px solid #d0d8ff;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    outline: none;
  }
  .stp-preset:hover,
  .stp-preset.active {
    background: #667eea;
    color: #fff;
    border-color: #667eea;
  }

  /* 倒计时进度 */
  .stp-alarm-progress {
    margin-top: 10px;
  }
  .stp-alarm-progress-bar {
    height: 4px;
    background: #f0f0f0;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 5px;
  }
  .stp-alarm-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 2px;
    transition: width 1s linear;
  }
  .stp-alarm-remain {
    font-size: 11px;
    color: #aaa;
  }

  @media (max-width: 768px) {
    .stp-elapsed {
      font-size: 44px;
    }

    .stp-timer-area {
      padding: 16px 16px 6px;
    }

    .stp-btn-start,
    .stp-btn-stop {
      padding: 14px;
      font-size: 16px;
      min-height: 48px;
    }
  }
</style>
