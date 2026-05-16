import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult } from '../api/index.js';
import { FOLLOW_UP_OFFSETS, MAX_FOLLOW_UP_INSERTIONS, insertFollowUpCard } from './studyQueue.js';
import { useChoiceMode } from './useChoiceMode.js';
import { useSpellingMode } from './useSpellingMode.js';
import { useStudyKeyboard } from './useStudyKeyboard.js';
import { seekToStudyCard, getStudySessionSyncChannel } from './studySessionHelpers.js';
import { useAutoRead } from './useAutoRead.js';
import { useSessionProgress } from './useSessionProgress.js';

const refreshChoiceState = (choice, queue) => {
  choice.setQueueWords(queue.value.map((record) => record.word));
  choice.loadChoices();
};

export { seekToStudyCard } from './studySessionHelpers.js';
export { buildAutoReadTexts } from './studySessionHelpers.js';

export function useStudySession() {
  const route = useRoute();
  let stopSessionSync = () => {};

  const loading = ref(true);
  const queue = ref([]);
  const originalQueue = ref([]);
  const currentIndex = ref(0);
  const showAnswer = ref(false);
  const submitting = ref(false);
  const finished = ref(false);
  const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const againCountMap = ref({});
  const followUpCountMap = ref({});
  const resumeInfo = ref(null);
  const isReplay = ref(false);
  const sessionRevision = ref(0);

  const studyMode = ref('flashcard');
  const modeSelected = ref(false);
  const modeNames = {
    flashcard: '闪卡',
    choice: '选择题',
    spelling: '拼写',
    listening: '听力',
    autoRead: '自动朗读',
  };

  const getScope = () => (typeof route.query.scope === 'string' ? route.query.scope : '');
  const getQueueIds = () => queue.value.map((record) => record.wordId).join(',');

  const currentCard = computed(() => {
    if (currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value];
    }
    return null;
  });

  const againWordIds = computed(() => Object.keys(againCountMap.value).map(Number));
  const hasAgainWords = computed(() => againWordIds.value.length > 0);
  const againWordCount = computed(() => againWordIds.value.length);
  const originalQueueLength = computed(() => originalQueue.value.length);

  const queueFollowUpCard = (wordId, offset) => {
    if (!currentCard.value || currentCard.value.wordId !== wordId) return;

    const currentCount = followUpCountMap.value[wordId] || 0;
    if (currentCount >= MAX_FOLLOW_UP_INSERTIONS) return;

    followUpCountMap.value[wordId] = currentCount + 1;
    queue.value = insertFollowUpCard(queue.value, currentCard.value, currentIndex.value, offset);
  };

  const handleAgain = (wordId) => {
    if (!currentCard.value || currentCard.value.wordId !== wordId) return;

    const count = againCountMap.value[wordId] || 0;
    againCountMap.value[wordId] = count + 1;
    queueFollowUpCard(wordId, FOLLOW_UP_OFFSETS.AGAIN);
  };

  const handleHard = (wordId) => {
    queueFollowUpCard(wordId, FOLLOW_UP_OFFSETS.HARD);
  };

  // 初始化子模式 composable（依赖 currentCard、sessionStats、handleAgain、advanceCard）
  // advanceCard 通过 getter 延迟绑定，在 useAutoRead 内部仅在 watch 回调中调用
  const choice = useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard: () => advanceCard(), isReplay });
  const spelling = useSpellingMode({
    currentCard,
    sessionStats,
    handleAgain,
    handleHard,
    advanceCard: () => advanceCard(),
    isReplay,
  });

  // ── 模式生命周期辅助 ──────────────────────────────────────────────
  const resetAllModes = () => {
    choice.resetChoice();
    spelling.resetSpelling();
  };

  const initModeCard = (mode) => {
    if (mode === 'choice') {
      refreshChoiceState(choice, queue);
    }
  };

  const { saveProgress, clearProgress, applyRemoteProgress, handleStudySessionSync } =
    useSessionProgress({
      getScope,
      getQueueIds,
      queue,
      currentIndex,
      studyMode,
      modeSelected,
      sessionStats,
      againCountMap,
      finished,
      showAnswer,
      resumeInfo,
      resetAllModes,
      initModeCard,
    });

  // 推进到下一张卡片（通知各模式重置自身状态）
  const advanceCard = () => {
    currentIndex.value++;
    showAnswer.value = false;
    resetAllModes();

    if (currentIndex.value >= queue.value.length) {
      finished.value = true;
      clearProgress();
    } else {
      saveProgress();
      initModeCard(studyMode.value);
    }
  };

  const { stopAutoRead, toggleAutoReadPause, isAutoReadPaused, speak } = useAutoRead({
    currentCard,
    studyMode,
    modeSelected,
    sessionStats,
    advanceCard,
  });

  const selectMode = (mode) => {
    stopAutoRead();
    studyMode.value = mode;
    modeSelected.value = true;
    localStorage.setItem('study-mode', mode);
    getStudySessionSyncChannel().publish({
      type: 'mode',
      mode,
      scope: getScope(),
      queueIds: getQueueIds(),
    });
    initModeCard(mode);
  };

  const fetchDue = async () => {
    loading.value = true;
    try {
      const saved = localStorage.getItem('study-session-progress');
      const scope = typeof route.query.scope === 'string' ? route.query.scope : '';
      const params = { ...(scope ? { scope } : {}) };
      const res = await getReviewDue(params);
      queue.value = res.data || [];
      originalQueue.value = [...queue.value];

      if (saved && queue.value.length > 0) {
        try {
          const progress = JSON.parse(saved);
          const queueIds = queue.value.map((r) => r.wordId).join(',');
          const progressScope = progress.scope || '';
          if (
            progress.queueIds === queueIds &&
            progressScope === scope &&
            progress.index > 0 &&
            progress.index < queue.value.length &&
            queue.value[progress.index]?.wordId !== undefined
          ) {
            resumeInfo.value = progress;
          }
        } catch {
          /* ignore corrupt data */
        }
      }

      if (queue.value.length === 0) {
        finished.value = false;
      }
    } catch {
      ElMessage.error('获取复习队列失败');
    } finally {
      loading.value = false;
    }
  };

  // 断点续学操作
  const applyResume = () => {
    stopAutoRead();
    const progress = resumeInfo.value;
    resumeInfo.value = null;
    currentIndex.value = progress.index;
    sessionStats.value = progress.stats || sessionStats.value;
    againCountMap.value = progress.againMap || {};
    studyMode.value = progress.mode || 'flashcard';
    modeSelected.value = true;
    initModeCard(studyMode.value);
    saveProgress();
  };

  const dismissResume = () => {
    resumeInfo.value = null;
    clearProgress();
  };

  const incrementRevision = () => {
    sessionRevision.value++;
  };

  const resetSession = (replay = false) => {
    stopAutoRead();
    currentIndex.value = 0;
    finished.value = false;
    modeSelected.value = false;
    showAnswer.value = false;
    sessionStats.value = { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
    againCountMap.value = {};
    followUpCountMap.value = {};
    isReplay.value = replay;
  };

  const replayWithNewMode = () => {
    queue.value = [...originalQueue.value];
    resetSession();
  };

  const replayAgainWords = () => {
    const ids = new Set(againWordIds.value);
    queue.value = originalQueue.value.filter((item) => ids.has(item.wordId));
    originalQueue.value = [...queue.value];
    resetSession();
  };

  const continueReview = () => {
    const ids = new Set(againWordIds.value);
    const againWords = originalQueue.value.filter((item) => ids.has(item.wordId));
    const otherWords = originalQueue.value.filter((item) => !ids.has(item.wordId));
    queue.value = [...againWords, ...otherWords];
    originalQueue.value = [...queue.value];
    resetSession();
  };

  const flipCard = () => {
    showAnswer.value = true;
    if (currentCard.value) {
      speak(currentCard.value.word.name);
    }
  };

  const seekToIndex = (targetIndex) =>
    seekToStudyCard({
      targetIndex,
      queue,
      currentIndex,
      finished,
      showAnswer,
      submitting,
      studyMode,
      resetModes: resetAllModes,
      initModeCard,
      saveProgress,
      incrementRevision,
      stopAutoRead,
    });

  const submitRating = async (quality) => {
    if (submitting.value) return;
    submitting.value = true;
    const wordId = currentCard.value.wordId;
    const revision = sessionRevision.value;
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    try {
      if (!isReplay.value) {
        await submitReviewResult(wordId, quality);
      }
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;
      if (quality === 1) handleAgain(wordId);
      if (quality === 2) handleHard(wordId);
      if (revision === sessionRevision.value) {
        advanceCard();
      }
    } catch {
      ElMessage.error('提交复习结果失败');
    } finally {
      submitting.value = false;
    }
  };

  // 键盘快捷键（逻辑已提取至 useStudyKeyboard，此处仅负责挂载/卸载）
  const { handleKeyDown } = useStudyKeyboard({
    studyMode,
    modeSelected,
    finished,
    currentCard,
    showAnswer,
    submitting,
    speak,
    choice: {
      choiceAnswered: choice.choiceAnswered,
      choiceOptions: choice.choiceOptions,
      handleChoice: choice.handleChoice,
      choiceNext: choice.choiceNext,
    },
    spelling: {
      spellingAnswered: spelling.spellingAnswered,
      checkSpelling: spelling.checkSpelling,
      spellingNext: spelling.spellingNext,
    },
    flipCard,
    submitRating,
  });

  onMounted(() => {
    fetchDue();
    stopSessionSync = getStudySessionSyncChannel().subscribe(handleStudySessionSync);
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    stopAutoRead();
    stopSessionSync();
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    loading,
    queue,
    originalQueue,
    currentIndex,
    showAnswer,
    submitting,
    finished,
    sessionStats,
    againCountMap,
    resumeInfo,
    studyMode,
    modeSelected,
    modeNames,
    currentCard,
    // 选择题（来自 useChoiceMode）
    choiceOptions: choice.choiceOptions,
    choiceSelected: choice.choiceSelected,
    choiceAnswered: choice.choiceAnswered,
    // 拼写 & 听力（来自 useSpellingMode）
    spellingInput: spelling.spellingInput,
    spellingAnswered: spelling.spellingAnswered,
    spellingCorrect: spelling.spellingCorrect,
    spellingHard: spelling.spellingHard,
    spellingHint: spelling.spellingHint,
    spellingHintLevel: spelling.spellingHintLevel,
    isAutoReadPaused,
    hasAgainWords,
    againWordCount,
    originalQueueLength,
    selectMode,
    seekToIndex,
    applyResume,
    dismissResume,
    replayWithNewMode,
    replayAgainWords,
    continueReview,
    flipCard,
    submitRating,
    toggleAutoReadPause,
    loadChoices: choice.loadChoices,
    handleChoice: choice.handleChoice,
    choiceNext: choice.choiceNext,
    checkSpelling: spelling.checkSpelling,
    showSpellingHint: spelling.showSpellingHint,
    spellingNext: spelling.spellingNext,
  };
}
