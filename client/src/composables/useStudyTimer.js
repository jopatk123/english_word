import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  createStudyTimerSocket,
  endStudySession,
  getStudySessionStats,
  getStudyTimerState,
  startStudySession,
} from '../api/index.js';

const STORAGE_KEY = 'english-word-study-timer';

function unwrapResponse(response) {
  return response?.data ?? response;
}

export function useStudyTimer() {
  /* ── 计时器状态 ── */
  const isRunning = ref(false);
  const elapsedSeconds = ref(0);
  const sessionId = ref(null);
  const actionPending = ref(false);
  let _startedAtMs = 0;
  let _tickTimer = null;
  let _statsRefreshTimer = null;
  let _socket = null;
  let _reconnectTimer = null;
  let _reconnectAttempt = 0;
  let _serverClockOffsetMs = 0;
  let _manuallyClosed = false;
  let _lastAppliedStateOrder = { stateChangedAtMs: 0, sessionId: 0, isRunning: 0 };

  /* ── 休息提醒状态 ── */
  const alarmEnabled = ref(false);
  const alarmMinutes = ref(30);
  const restNotifyVisible = ref(false);
  const alarmTriggered = ref(false);

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
      Math.floor((getSyncedNowMs() - Math.max(_startedAtMs, todayStartMs)) / 1000)
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
    const seconds = alarmRemainingSeconds.value;
    if (seconds === null) return '';
    return formatSeconds(seconds);
  });

  function formatSeconds(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    const pad = (value) => String(value).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  }

  function formatSecondsToText(seconds) {
    if (!seconds) return '0分钟';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${m || 1}分钟`;
  }

  function getLocalTodayStartMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function getSyncedNowMs() {
    return Date.now() + _serverClockOffsetMs;
  }

  function buildPreferenceState() {
    return {
      alarmEnabled: alarmEnabled.value,
      alarmMinutes: alarmMinutes.value,
    };
  }

  function persistPreferences() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPreferenceState()));
  }

  function restorePreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      alarmEnabled.value = Boolean(saved?.alarmEnabled);
      alarmMinutes.value = Number(saved?.alarmMinutes) || 30;
    } catch {
      // 数据损坏静默忽略
    }
  }

  function getStateOrder(state) {
    return {
      stateChangedAtMs: Number(state?.stateChangedAtMs) || 0,
      sessionId: Number(state?.sessionId) || 0,
      isRunning: state?.isRunning ? 1 : 0,
    };
  }

  function shouldApplyState(state, force = false) {
    if (force) return true;

    const next = getStateOrder(state);
    const current = _lastAppliedStateOrder;

    if (next.stateChangedAtMs !== current.stateChangedAtMs) {
      return next.stateChangedAtMs > current.stateChangedAtMs;
    }
    if (next.sessionId !== current.sessionId) {
      return next.sessionId > current.sessionId;
    }
    if (next.isRunning !== current.isRunning) {
      return next.isRunning > current.isRunning;
    }

    return false;
  }

  function clearRunningState() {
    isRunning.value = false;
    sessionId.value = null;
    elapsedSeconds.value = 0;
    _startedAtMs = 0;
    alarmTriggered.value = false;
    restNotifyVisible.value = false;
    _stopTicker();
  }

  function maybeTriggerAlarm(elapsed) {
    if (
      alarmEnabled.value &&
      !alarmTriggered.value &&
      alarmMinutes.value > 0 &&
      elapsed >= alarmMinutes.value * 60
    ) {
      alarmTriggered.value = true;
      _triggerRestAlarm();
    }
  }

  function applyAuthoritativeState(state, options = {}) {
    if (!state || !shouldApplyState(state, options.force)) {
      return false;
    }

    const wasRunning = isRunning.value;
    _lastAppliedStateOrder = getStateOrder(state);

    const serverNowMs = new Date(state.serverNow).getTime();
    if (Number.isFinite(serverNowMs)) {
      _serverClockOffsetMs = serverNowMs - Date.now();
    }

    const startedAtMs = new Date(state.startedAt).getTime();
    if (!state.isRunning || !Number.isFinite(startedAtMs)) {
      clearRunningState();
      if (wasRunning) {
        void loadStats();
      }
      return true;
    }

    sessionId.value = state.sessionId || null;
    _startedAtMs = startedAtMs;
    elapsedSeconds.value = Math.max(
      Number(state.elapsedSeconds) || 0,
      Math.floor((getSyncedNowMs() - startedAtMs) / 1000)
    );
    isRunning.value = true;
    restNotifyVisible.value = false;
    alarmTriggered.value = false;

    maybeTriggerAlarm(elapsedSeconds.value);
    _startTicker();
    return true;
  }

  async function syncStateFromServer(options = {}) {
    try {
      const state = unwrapResponse(await getStudyTimerState());
      applyAuthoritativeState(state, { force: options.force });
    } catch {
      // 静默忽略，等待下次 websocket / 页面激活时重试
    }
  }

  function clearReconnectTimer() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (_manuallyClosed || _reconnectTimer) return;

    const delay = Math.min(15000, 1000 * 2 ** _reconnectAttempt);
    _reconnectAttempt += 1;
    _reconnectTimer = window.setTimeout(() => {
      _reconnectTimer = null;
      connectSocket();
    }, delay);
  }

  function disconnectSocket() {
    clearReconnectTimer();
    if (_socket) {
      _socket.close();
      _socket = null;
    }
  }

  function connectSocket() {
    if (_socket || _manuallyClosed) return;

    try {
      const socket = createStudyTimerSocket();
      if (!socket) return;

      _socket = socket;
      socket.addEventListener('open', () => {
        _reconnectAttempt = 0;
        void syncStateFromServer();
      });
      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'study-timer/state') {
            applyAuthoritativeState(payload.data);
          }
        } catch {
          // 忽略非预期消息
        }
      });
      socket.addEventListener('close', () => {
        if (_socket === socket) {
          _socket = null;
        }
        scheduleReconnect();
      });
      socket.addEventListener('error', () => {
        socket.close();
      });
    } catch {
      scheduleReconnect();
    }
  }

  async function startTimer(note = '') {
    if (isRunning.value || actionPending.value) return;

    actionPending.value = true;
    try {
      const state = unwrapResponse(await startStudySession(note));
      applyAuthoritativeState(state, { force: true });
    } catch {
      // 服务端权威模式下，不再回退到本地计时
    } finally {
      actionPending.value = false;
    }
  }

  async function stopTimer() {
    if (!isRunning.value || actionPending.value) return;

    const duration = elapsedSeconds.value;
    actionPending.value = true;
    try {
      if (sessionId.value) {
        const state = unwrapResponse(await endStudySession(sessionId.value));
        applyAuthoritativeState(state, { force: true });
      }
      await loadStats();
    } catch {
      // 静默忽略，等待权威状态或页面激活时校准
    } finally {
      actionPending.value = false;
    }

    return duration;
  }

  function dismissRestAlarm() {
    restNotifyVisible.value = false;
  }

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

  function _startTicker() {
    _stopTicker();
    _tickTimer = setInterval(() => {
      if (!isRunning.value) return;
      elapsedSeconds.value = Math.max(0, Math.floor((getSyncedNowMs() - _startedAtMs) / 1000));
      maybeTriggerAlarm(elapsedSeconds.value);
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
    void syncStateFromServer();
  }

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

  watch([alarmEnabled, alarmMinutes], () => {
    persistPreferences();
  });

  onMounted(async () => {
    restorePreferences();
    await syncStateFromServer({ force: true });
    connectSocket();
    await loadStats();
    _statsRefreshTimer = window.setInterval(_refreshStatsIfVisible, 60 * 1000);
    document.addEventListener('visibilitychange', _refreshStatsIfVisible);
    window.addEventListener('focus', _refreshStatsIfVisible);
  });

  onUnmounted(() => {
    _manuallyClosed = true;
    _stopTicker();
    disconnectSocket();
    if (_statsRefreshTimer) {
      clearInterval(_statsRefreshTimer);
      _statsRefreshTimer = null;
    }
    document.removeEventListener('visibilitychange', _refreshStatsIfVisible);
    window.removeEventListener('focus', _refreshStatsIfVisible);
  });

  return {
    isRunning,
    sessionId,
    elapsedSeconds,
    elapsedDisplay,
    alarmEnabled,
    alarmMinutes,
    alarmTriggered,
    alarmRemainingSeconds,
    alarmRemainingDisplay,
    alarmProgressPct,
    restNotifyVisible,
    totalSeconds,
    savedTotalSeconds,
    todaySeconds,
    recentSessions,
    statsLoading,
    actionPending,
    startTimer,
    stopTimer,
    dismissRestAlarm,
    loadStats,
    formatSecondsToText,
  };
}
