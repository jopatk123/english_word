import { ref } from 'vue';

const speakingText = ref('');
const isPaused = ref(false);
let pendingSpeech = null;
let speechRequestId = 0;
const pauseWaiters = new Set();
const activeDelayControllers = new Set();

/**
 * 从已加载的 voices 列表中挑选最优英语语音。
 * 优先顺序：macOS 高质量原声 > en-US > en-*
 */
function pickEnglishVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // macOS / iOS 高质量英语语音，按偏好排序
  const preferred = ['Samantha', 'Alex', 'Daniel', 'Karen', 'Moira', 'Tessa', 'Rishi'];
  for (const name of preferred) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }

  // 次选：任意 en-US 语音
  const enUS = voices.find((v) => v.lang === 'en-US');
  if (enUS) return enUS;

  // 最后兜底：任意英语语音
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

/**
 * 等待 speechSynthesis voices 列表加载完成后执行回调。
 * voices 列表是异步加载的，直接调用 getVoices() 可能返回空数组。
 */
function withVoices(callback) {
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    callback();
  } else {
    synth.addEventListener('voiceschanged', callback, { once: true });
  }
}

function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function releasePauseWaiters(result) {
  if (pauseWaiters.size === 0) return;

  const waiters = [...pauseWaiters];
  pauseWaiters.clear();
  for (const resolve of waiters) {
    resolve(result);
  }
}

function waitForResume() {
  if (!isPaused.value) return Promise.resolve(true);

  return new Promise((resolve) => {
    const waiter = (result) => {
      pauseWaiters.delete(waiter);
      resolve(result);
    };

    pauseWaiters.add(waiter);
  });
}

function releaseDelayControllers(result) {
  if (activeDelayControllers.size === 0) return;

  const controllers = [...activeDelayControllers];
  activeDelayControllers.clear();
  for (const controller of controllers) {
    controller.cancel(result);
  }
}

function waitForDelay(delayMs) {
  if (delayMs <= 0) return Promise.resolve(true);

  return new Promise((resolve) => {
    let remaining = delayMs;
    const step = Math.min(50, delayMs);

    const finish = (result) => {
      if (controller.done) return;
      controller.done = true;
      clearInterval(controller.timer);
      activeDelayControllers.delete(controller);
      resolve(result);
    };

    const controller = {
      done: false,
      timer: null,
      cancel: finish,
    };

    controller.timer = setInterval(() => {
      if (controller.done) return;

      if (!isPaused.value) {
        remaining -= Math.min(step, remaining);
        if (remaining <= 0) {
          finish(true);
        }
      }
    }, step);

    activeDelayControllers.add(controller);
  });
}

function cancelSpeech() {
  const pending = pendingSpeech;
  pendingSpeech = null;
  isPaused.value = false;
  releasePauseWaiters(false);
  releaseDelayControllers(false);
  speakingText.value = '';

  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }

  if (pending) {
    pending.resolve(false);
  }
}

function pauseSpeech() {
  if (!isSpeechSupported()) return;

  isPaused.value = true;
  window.speechSynthesis.pause();
}

function resumeSpeech() {
  if (!isSpeechSupported()) return;
  if (!isPaused.value) return;

  isPaused.value = false;
  window.speechSynthesis.resume();
  releasePauseWaiters(true);
}

function startSpeech(text, lang = 'en-US') {
  if (!isSpeechSupported()) return Promise.resolve(false);

  if (isPaused.value) {
    return waitForResume().then((resumed) => (resumed ? startSpeech(text, lang) : false));
  }

  cancelSpeech();

  const requestId = ++speechRequestId;
  speakingText.value = text;

  return new Promise((resolve) => {
    pendingSpeech = { id: requestId, resolve };

    withVoices(() => {
      if (!pendingSpeech || pendingSpeech.id !== requestId) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.85;

      const voice = pickEnglishVoice();
      if (voice) utterance.voice = voice;

      const finalize = (result) => {
        if (!pendingSpeech || pendingSpeech.id !== requestId) return;
        pendingSpeech = null;
        speakingText.value = '';
        resolve(result);
      };

      utterance.onend = () => finalize(true);
      utterance.onerror = () => finalize(false);

      window.speechSynthesis.speak(utterance);
    });
  });
}

export function useSpeech() {
  const speak = (text, lang = 'en-US') => {
    if (!isSpeechSupported()) return;

    // Toggle: click again to stop
    if (speakingText.value === text) {
      cancelSpeech();
      return;
    }

    void startSpeech(text, lang);
  };

  const speakAsync = (text, lang = 'en-US') => startSpeech(text, lang);

  const speakSequence = async (texts, lang = 'en-US', delayMs = 0, delayAfterLast = false) => {
    if (!isSpeechSupported()) return true;

    const sequence = Array.isArray(texts) ? texts : [texts];
    const validTexts = sequence.filter((text) => typeof text === 'string' && text.trim());

    for (const [index, text] of validTexts.entries()) {
      const spoken = await speakAsync(text, lang);
      if (!spoken) return false;

      if (delayMs > 0 && (delayAfterLast || index < validTexts.length - 1)) {
        const waited = await waitForDelay(delayMs);
        if (!waited) return false;
      }
    }

    return true;
  };

  return {
    speak,
    speakAsync,
    speakSequence,
    cancelSpeech,
    pauseSpeech,
    resumeSpeech,
    speakingText,
    isPaused,
  };
}
