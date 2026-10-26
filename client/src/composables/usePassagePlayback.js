import { computed, onUnmounted, ref, unref } from 'vue';
import { DEFAULT_SPEECH_RATE, useSpeech } from '../utils/speech.js';
import { PASSAGE_SPEECH_RATES, PASSAGE_SPEECH_RATE_STORAGE_KEY } from '../constants/passage.js';

const SENTENCE_GAP_MS = 350;

const loadRate = () => {
  const stored = Number(localStorage.getItem(PASSAGE_SPEECH_RATE_STORAGE_KEY));
  return PASSAGE_SPEECH_RATES.some((option) => option.value === stored)
    ? stored
    : DEFAULT_SPEECH_RATE;
};

/**
 * 逐句朗读状态机。
 * play 从指定句起连续朗读到结尾；playSentence 只朗读那一句，结束后停住。
 * 暂停时直接取消当前句、记住位置，继续时从这句开头重读：
 * 部分移动端浏览器不支持 speechSynthesis.pause，这样行为在各端一致。
 */
export function usePassagePlayback(sentencesSource, options = {}) {
  const { onFinished } = options;
  const { speakAsync, cancelSpeech } = useSpeech();

  const playing = ref(false);
  const currentIndex = ref(-1);
  const loop = ref(false);
  const rate = ref(loadRate());
  let runId = 0;

  const sentences = computed(() => unref(sentencesSource) || []);
  const currentSentence = computed(() => sentences.value[currentIndex.value] || null);

  const wait = (ms, id) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(id === runId), ms);
    });

  const clampIndex = (index, length) => Math.min(Math.max(index, 0), length - 1);

  const run = async (startIndex) => {
    const id = ++runId;
    const list = sentences.value;
    if (!list.length) return;

    playing.value = true;
    let index = clampIndex(startIndex, list.length);
    while (id === runId && index < list.length) {
      currentIndex.value = index;
      const spoken = await speakAsync(list[index].text, 'en-US', { rate: rate.value });
      if (id !== runId) return;
      // 朗读被其他按钮打断或浏览器报错：停在当前句，等用户继续
      if (!spoken) {
        playing.value = false;
        return;
      }
      if (!(await wait(SENTENCE_GAP_MS, id))) return;
      if (!loop.value) index += 1;
    }

    if (id === runId) {
      playing.value = false;
      currentIndex.value = -1;
      onFinished?.();
    }
  };

  const halt = () => {
    runId += 1;
    playing.value = false;
    cancelSpeech();
  };

  const play = (index = currentIndex.value >= 0 ? currentIndex.value : 0) => {
    void run(index);
  };

  // 句末 ▶：只读这一句。不循环、不前进，也不当作整篇听完。
  const playSentence = (index) => {
    const list = sentences.value;
    if (!list.length) return;

    const id = ++runId;

    const target = clampIndex(index, list.length);
    playing.value = true;
    currentIndex.value = target;

    void (async () => {
      await speakAsync(list[target].text, 'en-US', { rate: rate.value });
      if (id !== runId) return;
      playing.value = false;
    })();
  };

  const pause = () => halt();

  const toggle = () => (playing.value ? pause() : play());

  const stop = () => {
    halt();
    currentIndex.value = -1;
  };

  const jump = (offset) => {
    const last = sentences.value.length - 1;
    if (last < 0) return;
    const base = currentIndex.value >= 0 ? currentIndex.value : 0;
    const target = Math.min(Math.max(base + offset, 0), last);
    if (playing.value) play(target);
    else currentIndex.value = target;
  };

  const setRate = (value) => {
    rate.value = value;
    localStorage.setItem(PASSAGE_SPEECH_RATE_STORAGE_KEY, String(value));
  };

  const toggleLoop = () => {
    loop.value = !loop.value;
  };

  onUnmounted(stop);

  return {
    playing,
    currentIndex,
    currentSentence,
    loop,
    rate,
    play,
    playSentence,
    pause,
    toggle,
    stop,
    next: () => jump(1),
    prev: () => jump(-1),
    setRate,
    toggleLoop,
  };
}
