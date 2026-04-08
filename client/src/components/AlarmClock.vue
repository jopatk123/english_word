<template>
  <div class="alarm-wrapper" ref="wrapperRef">
    <!-- 铃铛按钮 -->
    <button
      class="alarm-btn"
      :class="{ 'alarm-running': isRunning }"
      :title="alarmBtnTitle"
      @click.stop="togglePanel"
    >
      <span class="alarm-bell" :class="{ ringing: triggered, lit: isRunning }">🔔</span>
      <span v-if="showBadge" class="alarm-badge">{{ badge }}</span>
    </button>

    <!-- 下拉面板 -->
    <transition name="alarm-panel-fade">
      <div v-if="panelVisible" class="alarm-panel" @click.stop>
        <!-- 标题栏 -->
        <div class="ap-header">
          <span class="ap-title">⏰ 学习提醒</span>
          <button class="ap-close" @click="panelVisible = false" title="关闭">×</button>
        </div>

        <!-- 模式切换 -->
        <div class="ap-tabs">
          <button
            :class="['ap-tab', { active: mode === 'alarm' }]"
            :disabled="isRunning"
            @click="mode = 'alarm'"
          >
            🕐 闹钟
          </button>
          <button
            :class="['ap-tab', { active: mode === 'countdown' }]"
            :disabled="isRunning"
            @click="mode = 'countdown'"
          >
            ⏳ 倒计时
          </button>
        </div>

        <!-- 闹钟模式 -->
        <div v-if="mode === 'alarm'" class="ap-body">
          <label class="ap-label">设定提醒时间</label>
          <input
            type="time"
            v-model="alarmTime"
            :disabled="isRunning"
            class="ap-time-input"
          />
          <div v-if="isRunning" class="ap-status">
            ✅ 将在 <strong>{{ alarmTime }}</strong> 提醒你 · {{ timeUntilAlarm }}
          </div>
        </div>

        <!-- 倒计时模式 -->
        <div v-else class="ap-body">
          <label class="ap-label">快速选择</label>
          <div class="ap-presets">
            <button
              v-for="p in presets"
              :key="p.v"
              class="ap-preset"
              :disabled="isRunning"
              @click="setPreset(p.v)"
            >
              {{ p.l }}
            </button>
          </div>
          <label class="ap-label" style="margin-top: 8px">自定义时长</label>
          <div class="ap-time-fields">
            <div class="ap-time-field">
              <input
                type="number"
                v-model.number="cdHours"
                min="0"
                max="23"
                :disabled="isRunning"
                class="ap-num-input"
              />
              <span class="ap-unit">时</span>
            </div>
            <span class="ap-sep">:</span>
            <div class="ap-time-field">
              <input
                type="number"
                v-model.number="cdMinutes"
                min="0"
                max="59"
                :disabled="isRunning"
                class="ap-num-input"
              />
              <span class="ap-unit">分</span>
            </div>
            <span class="ap-sep">:</span>
            <div class="ap-time-field">
              <input
                type="number"
                v-model.number="cdSeconds"
                min="0"
                max="59"
                :disabled="isRunning"
                class="ap-num-input"
              />
              <span class="ap-unit">秒</span>
            </div>
          </div>
          <!-- 倒计时进行中显示 -->
          <div v-if="isRunning" class="ap-countdown-display">
            <span class="ap-countdown-time">{{ countdownDisplay }}</span>
            <span class="ap-countdown-label">剩余时间</span>
            <div class="ap-progress-bar">
              <div class="ap-progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- 提醒文字 -->
        <div class="ap-msg-row">
          <label class="ap-label">提醒文字（可选）</label>
          <input
            type="text"
            v-model="alarmMessage"
            placeholder="该学习啦！"
            maxlength="50"
            class="ap-msg-input"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="ap-actions">
          <button v-if="!isRunning" class="ap-btn-start" :disabled="!canStart" @click="startAlarm">
            ▶ 开始提醒
          </button>
          <button v-else class="ap-btn-stop" @click="stopAlarm">■ 取消提醒</button>
        </div>
      </div>
    </transition>

    <!-- 提醒弹窗 -->
    <el-dialog
      v-model="notifyVisible"
      :close-on-click-modal="false"
      :show-close="false"
      width="380px"
      align-center
      class="alarm-notify-dlg"
    >
      <div class="alarm-notify-body">
        <div class="alarm-notify-icon">🔔</div>
        <p class="alarm-notify-title">学习时间到啦！</p>
        <p class="alarm-notify-msg">{{ alarmMessage || '该学习英语词汇了！' }}</p>
      </div>
      <template #footer>
        <el-button type="primary" size="large" style="width: 100%" @click="dismissAlarm">
          知道了，去学习 📚
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue';

  /* ── 状态 ── */
  const wrapperRef = ref(null);
  const panelVisible = ref(false);

  const mode = ref('countdown'); // 'alarm' | 'countdown'
  const modeWhenStarted = ref('countdown');

  const alarmTime = ref(''); // HH:mm
  const cdHours = ref(0);
  const cdMinutes = ref(25);
  const cdSeconds = ref(0);
  const alarmMessage = ref('');

  const isRunning = ref(false);
  const triggered = ref(false);
  const notifyVisible = ref(false);

  // 倒计时运行时状态
  const remainingSeconds = ref(0);
  let _initialTotalSeconds = 0;
  let _startedAtMs = 0;

  /* ── 常量 ── */
  const STORAGE_KEY = 'english-word-alarm';
  const presets = [
    { l: '5分钟', v: 5 },
    { l: '25分钟（番茄）', v: 25 },
    { l: '45分钟', v: 45 },
    { l: '1小时', v: 60 },
  ];

  /* ── 计算属性 ── */
  const showBadge = computed(() => isRunning.value && !triggered.value);

  const badge = computed(() => {
    if (!isRunning.value || triggered.value) return '';
    if (modeWhenStarted.value === 'alarm') return alarmTime.value;
    return countdownDisplay.value;
  });

  const countdownDisplay = computed(() => {
    const s = remainingSeconds.value;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  });

  const progressPct = computed(() => {
    if (!_initialTotalSeconds) return 0;
    return Math.max(0, Math.min(100, (remainingSeconds.value / _initialTotalSeconds) * 100));
  });

  const timeUntilAlarm = computed(() => {
    if (!alarmTime.value) return '';
    const [h, m] = alarmTime.value.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = Math.floor((target - now) / 1000);
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (hrs > 0) return `约${hrs}小时${mins}分后`;
    if (mins > 0) return `约${mins}分${secs}秒后`;
    return `${secs}秒后`;
  });

  const canStart = computed(() => {
    if (mode.value === 'alarm') return !!alarmTime.value;
    return cdHours.value > 0 || cdMinutes.value > 0 || cdSeconds.value > 0;
  });

  const alarmBtnTitle = computed(() => {
    if (!isRunning.value) return '设置学习提醒';
    if (modeWhenStarted.value === 'alarm') return `闹钟: ${alarmTime.value}`;
    return `倒计时: ${badge.value}`;
  });

  /* ── 操作 ── */
  function setPreset(minutes) {
    cdHours.value = 0;
    cdMinutes.value = minutes;
    cdSeconds.value = 0;
  }

  function startAlarm() {
    if (!canStart.value) return;
    isRunning.value = true;
    triggered.value = false;
    modeWhenStarted.value = mode.value;

    if (mode.value === 'countdown') {
      _initialTotalSeconds = cdHours.value * 3600 + cdMinutes.value * 60 + cdSeconds.value;
      _startedAtMs = Date.now();
      remainingSeconds.value = _initialTotalSeconds;
    }

    saveState();
    panelVisible.value = false;
    startTicker();
  }

  function stopAlarm() {
    isRunning.value = false;
    triggered.value = false;
    clearTicker();
    notifyVisible.value = false;
    remainingSeconds.value = 0;
    clearState();
  }

  function dismissAlarm() {
    notifyVisible.value = false;
    triggered.value = false;
  }

  /* ── 计时器 ── */
  let _tickTimer = null;

  function startTicker() {
    clearTicker();
    _tickTimer = setInterval(tick, 1000);
  }

  function clearTicker() {
    if (_tickTimer) {
      clearInterval(_tickTimer);
      _tickTimer = null;
    }
  }

  function tick() {
    if (!isRunning.value || triggered.value) return;

    if (modeWhenStarted.value === 'alarm') {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      if (`${hh}:${mm}` === alarmTime.value) {
        triggerAlarm();
      }
    } else {
      const elapsed = Math.floor((Date.now() - _startedAtMs) / 1000);
      remainingSeconds.value = Math.max(0, _initialTotalSeconds - elapsed);
      if (remainingSeconds.value <= 0) {
        triggerAlarm();
      }
    }
  }

  function triggerAlarm() {
    triggered.value = true;
    isRunning.value = false;
    clearTicker();
    clearState();
    playAlarmSound();
    sendBrowserNotification();
    notifyVisible.value = true;
    panelVisible.value = false;
  }

  /* ── 声音 ── */
  function playAlarmSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // 连续 5 个上行音调营造提醒感
      const notes = [
        { freq: 660, t: 0.0 },
        { freq: 880, t: 0.22 },
        { freq: 660, t: 0.44 },
        { freq: 880, t: 0.66 },
        { freq: 1100, t: 0.88 },
        { freq: 880, t: 1.1 },
        { freq: 1100, t: 1.32 },
      ];
      notes.forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.35, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.19);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.2);
      });
    } catch {
      // 不支持 Web Audio API，静默忽略
    }
  }

  /* ── 浏览器通知 ── */
  async function sendBrowserNotification() {
    if (!('Notification' in window)) return;
    const msg = alarmMessage.value || '该学习英语词汇了！';
    if (Notification.permission === 'granted') {
      new Notification('📖 学习提醒', { body: msg });
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('📖 学习提醒', { body: msg });
      }
    }
  }

  /* ── 面板开关 & 外部点击关闭 ── */
  function togglePanel() {
    panelVisible.value = !panelVisible.value;
  }

  function handleOutsideClick(e) {
    if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
      panelVisible.value = false;
    }
  }

  /* ── localStorage 持久化 ── */
  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: modeWhenStarted.value,
        alarmTime: alarmTime.value,
        alarmMessage: alarmMessage.value,
        cdHours: cdHours.value,
        cdMinutes: cdMinutes.value,
        cdSeconds: cdSeconds.value,
        isRunning: isRunning.value,
        initialTotalSeconds: _initialTotalSeconds,
        startedAtMs: _startedAtMs,
      })
    );
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      alarmTime.value = s.alarmTime || '';
      alarmMessage.value = s.alarmMessage || '';
      mode.value = s.mode || 'countdown';
      cdHours.value = s.cdHours ?? 0;
      cdMinutes.value = s.cdMinutes ?? 25;
      cdSeconds.value = s.cdSeconds ?? 0;

      if (!s.isRunning) return;

      if (s.mode === 'countdown' && s.startedAtMs && s.initialTotalSeconds) {
        const elapsed = Math.floor((Date.now() - s.startedAtMs) / 1000);
        const remaining = s.initialTotalSeconds - elapsed;
        if (remaining > 0) {
          // 恢复倒计时
          isRunning.value = true;
          modeWhenStarted.value = 'countdown';
          _initialTotalSeconds = s.initialTotalSeconds;
          _startedAtMs = s.startedAtMs;
          remainingSeconds.value = remaining;
          startTicker();
        } else if (remaining > -60) {
          // 关闭期间刚好到点，立即触发
          triggerAlarm();
        } else {
          clearState();
        }
      } else if (s.mode === 'alarm' && s.alarmTime) {
        const [h, m] = s.alarmTime.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(h, m, 0, 0);
        if (target > now) {
          // 恢复闹钟
          isRunning.value = true;
          modeWhenStarted.value = 'alarm';
          startTicker();
        } else {
          clearState();
        }
      }
    } catch {
      // 状态损坏直接忽略
    }
  }

  /* ── 生命周期 ── */
  onMounted(() => {
    loadState();
    document.addEventListener('click', handleOutsideClick);
  });

  onUnmounted(() => {
    clearTicker();
    document.removeEventListener('click', handleOutsideClick);
  });
</script>

<style scoped>
  /* ── 容器 ── */
  .alarm-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  /* ── 铃铛按钮 ── */
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

  /* ── 铃铛图标 ── */
  .alarm-bell {
    font-size: 18px;
    display: inline-block;
    transition: filter 0.3s;
    line-height: 1;
  }

  .alarm-bell.lit {
    filter: drop-shadow(0 0 5px rgba(255, 220, 50, 1));
  }

  @keyframes ring {
    0%,
    100% {
      transform: rotate(0deg);
    }
    12% {
      transform: rotate(-22deg);
    }
    25% {
      transform: rotate(22deg);
    }
    37% {
      transform: rotate(-18deg);
    }
    50% {
      transform: rotate(18deg);
    }
    62% {
      transform: rotate(-12deg);
    }
    75% {
      transform: rotate(12deg);
    }
    87% {
      transform: rotate(-6deg);
    }
  }

  .alarm-bell.ringing {
    animation: ring 0.9s ease-in-out infinite;
    filter: drop-shadow(0 0 6px gold);
  }

  /* ── 倒计时徽标 ── */
  .alarm-badge {
    background: rgba(255, 224, 60, 0.95);
    color: #4a3800;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    line-height: 1.4;
    white-space: nowrap;
    letter-spacing: 0.3px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── 面板 ── */
  .alarm-panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 300px;
    background: #fff;
    border-radius: 14px;
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.18),
      0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    color: #333;
    overflow: hidden;
  }

  .alarm-panel-fade-enter-active,
  .alarm-panel-fade-leave-active {
    transition:
      opacity 0.22s,
      transform 0.22s;
  }

  .alarm-panel-fade-enter-from,
  .alarm-panel-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.97);
  }

  /* ── 面板标题 ── */
  .ap-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ap-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .ap-close {
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

  .ap-close:hover {
    color: #fff;
  }

  /* ── 模式 Tab ── */
  .ap-tabs {
    display: flex;
    border-bottom: 1px solid #f0f0f0;
  }

  .ap-tab {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #888;
    transition: all 0.2s;
    outline: none;
  }

  .ap-tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
    background: rgba(102, 126, 234, 0.04);
  }

  .ap-tab:not(.active):not(:disabled):hover {
    background: #f8f8f8;
    color: #555;
  }

  .ap-tab:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* ── 面板内容 ── */
  .ap-body {
    padding: 14px 16px 4px;
  }

  .ap-label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 7px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* -- 闹钟时间选择 -- */
  .ap-time-input {
    width: 100%;
    padding: 8px 12px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 26px;
    font-weight: 700;
    color: #333;
    outline: none;
    transition: border-color 0.2s;
    background: #fafafa;
    letter-spacing: 2px;
  }

  .ap-time-input:focus {
    border-color: #667eea;
    background: #fff;
  }

  .ap-time-input:disabled {
    background: #f0f0f0;
    color: #aaa;
  }

  .ap-status {
    margin-top: 9px;
    font-size: 13px;
    color: #667eea;
    background: rgba(102, 126, 234, 0.09);
    border-radius: 7px;
    padding: 7px 10px;
  }

  /* -- 倒计时快捷选项 -- */
  .ap-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .ap-preset {
    padding: 4px 10px;
    background: #f0f4ff;
    color: #667eea;
    border: 1.5px solid #d0d8ff;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    outline: none;
  }

  .ap-preset:not(:disabled):hover {
    background: #667eea;
    color: #fff;
    border-color: #667eea;
  }

  .ap-preset:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  /* -- 时/分/秒输入 -- */
  .ap-time-fields {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    justify-content: center;
    margin-top: 10px;
  }

  .ap-time-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .ap-sep {
    font-size: 24px;
    font-weight: 700;
    color: #bbb;
    padding-bottom: 20px;
    line-height: 1;
  }

  .ap-num-input {
    width: 60px;
    padding: 6px 4px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 22px;
    font-weight: 700;
    color: #333;
    text-align: center;
    outline: none;
    transition: border-color 0.2s;
    background: #fafafa;
    -moz-appearance: textfield;
  }

  .ap-num-input::-webkit-inner-spin-button,
  .ap-num-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }

  .ap-num-input:focus {
    border-color: #667eea;
    background: #fff;
  }

  .ap-num-input:disabled {
    background: #f0f0f0;
    color: #aaa;
  }

  .ap-unit {
    font-size: 12px;
    color: #aaa;
  }

  /* -- 倒计时进行中大字显示 -- */
  .ap-countdown-display {
    margin-top: 14px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    padding: 14px 12px 12px;
    text-align: center;
    color: #fff;
  }

  .ap-countdown-time {
    display: block;
    font-size: 38px;
    font-weight: 800;
    letter-spacing: 3px;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .ap-countdown-label {
    font-size: 12px;
    opacity: 0.75;
    display: block;
    margin-top: 4px;
  }

  .ap-progress-bar {
    margin-top: 10px;
    height: 5px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 3px;
    overflow: hidden;
  }

  .ap-progress-fill {
    height: 100%;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 3px;
    transition: width 1s linear;
  }

  /* ── 提醒文字输入 ── */
  .ap-msg-row {
    padding: 14px 16px 4px;
  }

  .ap-msg-input {
    width: 100%;
    padding: 7px 11px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    color: #333;
    outline: none;
    transition: border-color 0.2s;
    background: #fafafa;
  }

  .ap-msg-input:focus {
    border-color: #667eea;
    background: #fff;
  }

  /* ── 操作按钮 ── */
  .ap-actions {
    padding: 14px 16px 16px;
  }

  .ap-btn-start {
    width: 100%;
    padding: 11px;
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

  .ap-btn-start:not(:disabled):hover {
    opacity: 0.9;
  }

  .ap-btn-start:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .ap-btn-stop {
    width: 100%;
    padding: 11px;
    background: #ff6b6b;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    outline: none;
  }

  .ap-btn-stop:hover {
    background: #e85555;
  }

  /* ── 弹窗提醒内容 ── */
  :deep(.alarm-notify-dlg .el-dialog__footer) {
    padding: 0 24px 20px;
  }

  .alarm-notify-body {
    text-align: center;
    padding: 8px 0 4px;
  }

  .alarm-notify-icon {
    font-size: 60px;
    margin-bottom: 12px;
    display: block;
    animation: ring 0.9s ease-in-out infinite;
  }

  .alarm-notify-title {
    font-size: 22px;
    font-weight: 700;
    color: #333;
    margin: 0 0 8px;
  }

  .alarm-notify-msg {
    font-size: 15px;
    color: #666;
    margin: 0;
    line-height: 1.5;
  }

  /* ── 响应式 ── */
  @media (max-width: 768px) {
    .alarm-panel {
      right: -60px;
      width: 280px;
    }

    .alarm-badge {
      display: none;
    }
  }
</style>
