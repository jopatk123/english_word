import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { startStudySession, endStudySession, getStudySessionStats } from '../api/index.js';
import { createTabSyncChannel } from '../utils/tabSync.js';

const STORAGE_KEY = 'english-word-study-timer';

let studyTimerSyncChannel;

const getStudyTimerSyncChannel = () => {
  if (!studyTimerSyncChannel) {
    studyTimerSyncChannel = createTabSyncChannel('study-timer');
  }

  return studyTimerSyncChannel;
};

function unwrapResponse(response) {
  return response?.data ?? response;
}

export function useStudyTimer() {
  /* ── 计时器状态 ── */
  const isRunning = ref(false);
  const elapsedSeconds = ref(0);
  const sessionId = ref(null); // 当前 DB 会话 ID
  let _startedAtMs = 0;
  let _tickTimer = null;
  let _statsRefreshTimer = null;
  let _applyingRemoteState = false;
  let _stopTimerSync = () => {};

  /* ── 休息提醒状态 ── */
  const alarmEnabled = ref(false);
  const alarmMinutes = ref(30); // 设定提醒时长（分钟）
  const restNotifyVisible = ref(false); // 到时间弹窗
  const alarmTriggered = ref(false); // 已触发（防重复）

  /* ── 统计数据 ── */
  const savedTotalSeconds = ref(0);
  const todaySecondsBase = ref(0);
  const recentSessions = ref([]);
  const statsLoading = ref(false);

  /* ── 计算属性 ── */
  const elapsedDisplay = computed(() => formatSeconds(elapsedSeconds.value));

  const totalSeconds = computed(() => {
    void elapsedSeconds.value;
    return savedTotalSeconds.value + (isRunning.value ? elapsedSeconds.value : 0);
  });

  const todaySeconds = computed(() => {
    void elapsedSeconds.value;
    if (!isRunning.value) return todaySecondsBase.value;

    const todayStartMs = getLocalTodayStartMs();
    const runningTodaySeconds = Math.max(
      0,
      Math.floor((Date.now() - Math.max(_startedAtMs, todayStartMs)) / 1000)
    );

    return todaySecondsBase.value + runningTodaySeconds;
  });

  const alarmRemainingSeconds = computed(() => {
    if (!alarmEnabled.value || !isRunning.value || alarmTriggered.value) return null;
    const limit = alarmMinutes.value * 60;
    return Math.max(0, limit - elapsedSeconds.value);
  });

  const alarmProgressPct = computed(() => {
    if (!alarmEnabled.value || !alarmMinutes.value) return 0;
    const limit = alarmMinutes.value * 60;
    return Math.min(100, (elapsedSeconds.value / limit) * 100);
  });

  const alarmRemainingDisplay = computed(() => {
    const s = alarmRemainingSeconds.value;
    if (s === null) return '';
    return formatSeconds(s);
  });

  /* ── 工具函数 ── */
  function formatSeconds(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  }

  function formatSecondsToText(s) {
    if (!s) return '0分钟';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${m || 1}分钟`;
  }

  function getLocalTodayStartMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function buildLocalState() {
    return {
      isRunning: isRunning.value,
      sessionId: isRunning.value ? sessionId.value : null,
      startedAtMs: isRunning.value ? _startedAtMs : null,
      alarmEnabled: alarmEnabled.value,
      alarmMinutes: alarmMinutes.value,
    };
  }

  function persistLocalState() {
    const state = buildLocalState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (!_applyingRemoteState) {
      getStudyTimerSyncChannel().publish(state);
    }
  }

  function clearInvalidLocalState() {
    localStorage.removeItem(STORAGE_KEY);

    if (!_applyingRemoteState) {
      getStudyTimerSyncChannel().publish({
        isRunning: false,
        sessionId: null,
        startedAtMs: null,
        alarmEnabled: alarmEnabled.value,
        alarmMinutes: alarmMinutes.value,
      });
    }
  }

  function applyLocalState(state) {
    const wasRunning = isRunning.value;

    _applyingRemoteState = true;
    try {
      alarmEnabled.value = Boolean(state?.alarmEnabled);
      alarmMinutes.value = Number(state?.alarmMinutes) || 30;

      if (!state?.isRunning || !state?.startedAtMs) {
        isRunning.value = false;
        sessionId.value = null;
        elapsedSeconds.value = 0;
        _startedAtMs = 0;
        alarmTriggered.value = false;
        restNotifyVisible.value = false;
        _stopTicker();

        if (wasRunning) {
          void loadStats();
        }
        return;
      }

      const startedAtMs = Number(state.startedAtMs);
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      if (!Number.isFinite(startedAtMs) || elapsed < 0 || elapsed > 86400) {
        clearInvalidLocalState();
        isRunning.value = false;
        sessionId.value = null;
        elapsedSeconds.value = 0;
        _startedAtMs = 0;
        alarmTriggered.value = false;
        restNotifyVisible.value = false;
        _stopTicker();
        return;
      }

      sessionId.value = state.sessionId || null;
      _startedAtMs = startedAtMs;
      elapsedSeconds.value = elapsed;
      isRunning.value = true;
      restNotifyVisible.value = false;
      alarmTriggered.value = false;

      if (alarmEnabled.value && alarmMinutes.value > 0 && elapsed >= alarmMinutes.value * 60) {
        alarmTriggered.value = true;
        _triggerRestAlarm();
      }

      _startTicker();
    } finally {
      _applyingRemoteState = false;
    }
  }

  /* ── 开始学习 ── */
  async function startTimer(note = '') {
    if (isRunning.value) return;

    try {
      const result = unwrapResponse(await startStudySession(note));
      sessionId.value = result?.id ?? null;
      const startedAtMs = new Date(result?.startedAt).getTime();
      _startedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
    } catch {
      // 接口失败时仍使用本地计时，sessionId 为 null
      _startedAtMs = Date.now();
    }

    isRunning.value = true;
    elapsedSeconds.value = 0;
    alarmTriggered.value = false;
    _startTicker();
    persistLocalState();
  }

  /* ── 停止学习 ── */
  async function stopTimer() {
    if (!isRunning.value) return;

    isRunning.value = false;
    alarmTriggered.value = false;
    restNotifyVisible.value = false;
    _stopTicker();

    const duration = elapsedSeconds.value;

    if (sessionId.value) {
      try {
        await endStudySession(sessionId.value);
      } catch {
        // 静默忽略
      }
    }

    sessionId.value = null;
    elapsedSeconds.value = 0;
    _startedAtMs = 0;
    persistLocalState();

    // 刷新统计
    await loadStats();
    return duration;
  }

  /* ── 关闭休息提醒弹窗 ── */
  function dismissRestAlarm() {
    restNotifyVisible.value = false;
  }

  /* ── 加载统计 ── */
  async function loadStats() {
    statsLoading.value = true;
    try {
      const data = unwrapResponse(await getStudySessionStats());
      savedTotalSeconds.value = data?.totalSeconds || 0;
      todaySecondsBase.value = data?.todaySeconds || 0;
      recentSessions.value = data?.recentSessions || [];
    } catch {
      // 静默忽略
    } finally {
      statsLoading.value = false;
    }
  }

  /* ── 计时 tick ── */
  function _startTicker() {
    _stopTicker();
    _tickTimer = setInterval(() => {
      if (!isRunning.value) return;
      elapsedSeconds.value = Math.floor((Date.now() - _startedAtMs) / 1000);

      // 检查休息提醒
      if (
        alarmEnabled.value &&
        !alarmTriggered.value &&
        alarmMinutes.value > 0 &&
        elapsedSeconds.value >= alarmMinutes.value * 60
      ) {
        alarmTriggered.value = true;
        _triggerRestAlarm();
      }
    }, 1000);
  }

  function _stopTicker() {
    if (_tickTimer) {
      clearInterval(_tickTimer);
      _tickTimer = null;
    }
  }

  function _triggerRestAlarm() {
    _playAlarmSound();
    _sendBrowserNotification();
    restNotifyVisible.value = true;
  }

  function _refreshStatsIfVisible() {
    if (document.visibilityState !== 'visible') return;
    void loadStats();
  }

  /* ── 声音 ── */
  function _playAlarmSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [
        { freq: 660, t: 0.0 },
        { freq: 880, t: 0.22 },
        { freq: 660, t: 0.44 },
        { freq: 880, t: 0.66 },
        { freq: 1100, t: 0.88 },
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
  async function _sendBrowserNotification() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('⏰ 该休息一下了！', {
        body: `已持续学习 ${alarmMinutes.value} 分钟，为眼睛和大脑休息片刻吧`,
      });
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('⏰ 该休息一下了！', {
          body: `已持续学习 ${alarmMinutes.value} 分钟，为眼睛和大脑休息片刻吧`,
        });
      }
    }
  }

  function _restoreLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      applyLocalState(JSON.parse(raw));
    } catch {
      // 数据损坏静默忽略
    }
  }

  watch([alarmEnabled, alarmMinutes], () => {
    if (_applyingRemoteState) return;
    persistLocalState();
  });

  /* ── 生命周期 ── */
  onMounted(async () => {
    _restoreLocal();
    _stopTimerSync = getStudyTimerSyncChannel().subscribe((state) => {
      applyLocalState(state);
    });
    await loadStats();
    _statsRefreshTimer = window.setInterval(_refreshStatsIfVisible, 60 * 1000);
    document.addEventListener('visibilitychange', _refreshStatsIfVisible);
    window.addEventListener('focus', _refreshStatsIfVisible);
  });

  onUnmounted(() => {
    _stopTicker();
    if (_statsRefreshTimer) {
      clearInterval(_statsRefreshTimer);
      _statsRefreshTimer = null;
    }
    document.removeEventListener('visibilitychange', _refreshStatsIfVisible);
    window.removeEventListener('focus', _refreshStatsIfVisible);
    _stopTimerSync();
  });

  return {
    // 计时状态
    isRunning,
    elapsedSeconds,
    elapsedDisplay,
    // 休息提醒
    alarmEnabled,
    alarmMinutes,
    alarmTriggered,
    alarmRemainingSeconds,
    alarmRemainingDisplay,
    alarmProgressPct,
    restNotifyVisible,
    // 统计
    totalSeconds,
    savedTotalSeconds,
    todaySeconds,
    recentSessions,
    statsLoading,
    // 方法
    startTimer,
    stopTimer,
    dismissRestAlarm,
    loadStats,
    formatSecondsToText,
  };
}
