import { ref } from 'vue';

const speakingText = ref('');

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

export function useSpeech() {
  const speak = (text, lang = 'en-US') => {
    if (!('speechSynthesis' in window)) return;

    // Toggle: click again to stop
    if (speakingText.value === text) {
      window.speechSynthesis.cancel();
      speakingText.value = '';
      return;
    }

    window.speechSynthesis.cancel();
    speakingText.value = text;

    withVoices(() => {
      // 取消期间浏览器可能已切换状态，再次确认
      if (speakingText.value !== text) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.85;

      const voice = pickEnglishVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        speakingText.value = '';
      };
      utterance.onerror = () => {
        speakingText.value = '';
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  return { speak, speakingText };
}
