import { watch, nextTick } from 'vue';
import { useSpeech } from '../utils/speech.js';

/**
 * Manages auto-read (TTS) playback and passive card pronunciation.
 *
 * @param {object} deps
 * @param {import('vue').ComputedRef} deps.currentCard
 * @param {import('vue').Ref<string>}  deps.studyMode
 * @param {import('vue').Ref<boolean>} deps.modeSelected
 * @param {import('vue').Ref<object>}  deps.sessionStats
 * @param {() => void}                 deps.advanceCard - called when auto-read finishes a card
 */
export function useAutoRead({ currentCard, studyMode, modeSelected, sessionStats, advanceCard }) {
  const {
    speak,
    speakSequence,
    cancelSpeech,
    pauseSpeech,
    resumeSpeech,
    isPaused: isAutoReadPaused,
  } = useSpeech();

  let autoReadToken = 0;

  const stopAutoRead = () => {
    autoReadToken += 1;
    cancelSpeech();
  };

  const toggleAutoReadPause = () => {
    if (isAutoReadPaused.value) {
      resumeSpeech();
      return;
    }
    pauseSpeech();
  };

  const playAutoReadCard = async (card) => {
    const runToken = ++autoReadToken;
    const word = card?.word?.name?.trim();
    const sentences = (card?.word?.examples || [])
      .map((example) => example?.sentence?.trim())
      .filter(Boolean);
    const wordTexts = word ? [word, word] : [];

    if (wordTexts.length === 0 && sentences.length === 0) {
      if (runToken === autoReadToken) {
        sessionStats.value.total++;
        advanceCard();
      }
      return;
    }

    if (wordTexts.length > 0) {
      const readWords = await speakSequence(wordTexts, 'en-US');
      if (!readWords || runToken !== autoReadToken) return;
    }

    if (sentences.length > 0) {
      const readSentences = await speakSequence(sentences, 'en-US', 2000, true);
      if (!readSentences || runToken !== autoReadToken) return;
    }

    if (runToken !== autoReadToken || studyMode.value !== 'autoRead' || !modeSelected.value) {
      return;
    }

    sessionStats.value.total++;
    advanceCard();
  };

  // Pronounce each new card once; in autoRead mode drive the full sequence instead.
  watch(
    [currentCard, studyMode, modeSelected],
    ([card, mode, selected], previousValues = []) => {
      const [prevCard, prevMode, prevSelected] = previousValues;

      if (!card || !selected) return;

      const isNewCard = card !== prevCard;
      const justEnteredMode = mode !== prevMode;
      const justStarted = selected && !prevSelected;

      if (!(isNewCard || justEnteredMode || justStarted)) return;

      if (mode === 'autoRead') {
        void playAutoReadCard(card);
        return;
      }

      nextTick(() => {
        speak(card.word.name);
      });
    },
    { immediate: true }
  );

  return { stopAutoRead, toggleAutoReadPause, isAutoReadPaused, speak };
}
