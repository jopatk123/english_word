import { ref } from 'vue';

const speakingText = ref('');

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

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;

    utterance.onend = () => { speakingText.value = ''; };
    utterance.onerror = () => { speakingText.value = ''; };

    speakingText.value = text;
    window.speechSynthesis.speak(utterance);
  };

  return { speak, speakingText };
}
