import { ref } from 'vue';

const speakingText = ref('');
let pendingSpeech = null;
let speechRequestId = 0;

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

function cancelSpeech() {
  const pending = pendingSpeech;
  pendingSpeech = null;
  speakingText.value = '';

  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }

  if (pending) {
    pending.resolve(false);
  }
}

function startSpeech(text, lang = 'en-US') {
  if (!isSpeechSupported()) return Promise.resolve(false);

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

  const speakSequence = async (texts, lang = 'en-US') => {
    const sequence = Array.isArray(texts) ? texts : [texts];
    for (const text of sequence) {
      if (typeof text !== 'string' || !text.trim()) continue;
      await speakAsync(text, lang);
    }
  };

  return { speak, speakAsync, speakSequence, cancelSpeech, speakingText };
}
