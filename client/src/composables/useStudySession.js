import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult } from '../api/index.js';
import { useSpeech } from '../utils/speech.js';
import { createTabSyncChannel } from '../utils/tabSync.js';
import { useChoiceMode } from './useChoiceMode.js';
import { useSpellingMode } from './useSpellingMode.js';
import { FOLLOW_UP_OFFSETS, MAX_FOLLOW_UP_INSERTIONS, insertFollowUpCard } from './studyQueue.js';

let studySessionSyncChannel;

const getStudySessionSyncChannel = () => {
  if (!studySessionSyncChannel) {
    studySessionSyncChannel = createTabSyncChannel('study-session');
  }

  return studySessionSyncChannel;
};

export function seekToStudyCard({
  targetIndex,
  queue,
  currentIndex,
  finished,
  showAnswer,
  submitting,
  studyMode,
  choice,
  spelling,
  saveProgress,
  incrementRevision,
}) {
  if (submitting?.value) return false;
  if (!Number.isFinite(targetIndex) || queue.value.length === 0) return false;

  const nextIndex = Math.min(Math.max(Math.trunc(targetIndex), 0), queue.value.length - 1);
  if (nextIndex === currentIndex.value) return false;

  currentIndex.value = nextIndex;
  finished.value = false;
  showAnswer.value = false;
  choice.resetChoice();
  spelling.resetSpelling();

  if (typeof incrementRevision === 'function') {
    incrementRevision();
  }

  if (studyMode.value === 'choice') {
    choice.setQueueWords(queue.value.map((record) => record.word));
    choice.loadChoices();
  }

  saveProgress();
  return true;
}

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

  // 学习模式
  const studyMode = ref('flashcard');
  const modeSelected = ref(false);
  const modeNames = { flashcard: '闪卡', choice: '选择题', spelling: '拼写', listening: '听力' };

  const { speak } = useSpeech();

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

  // 推进到下一张卡片（通知各模式重置自身状态）
  const advanceCard = () => {
    currentIndex.value++;
    showAnswer.value = false;
    choice.resetChoice();
    spelling.resetSpelling();

    if (currentIndex.value >= queue.value.length) {
      finished.value = true;
      clearProgress();
    } else {
      saveProgress();
      if (studyMode.value === 'choice') choice.loadChoices();
    }
  };

  // 初始化子模式 composable（依赖 currentCard、sessionStats、handleAgain、advanceCard）
  const choice = useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay });
  const spelling = useSpellingMode({
    currentCard,
    sessionStats,
    handleAgain,
    handleHard,
    advanceCard,
    isReplay,
  });

  // 自动朗读：所有模式在新卡出现时朗读一次（闪卡翻牌时另由 flipCard 朗读）
  watch(
    [currentCard, studyMode, modeSelected],
    ([card, mode, selected], previousValues = []) => {
      const [prevCard, prevMode, prevSelected] = previousValues;

      if (!card || !selected) return;

      const isNewCard = card !== prevCard;
      const justEnteredMode = mode !== prevMode;
      const justStarted = selected && !prevSelected;

      if (isNewCard || justEnteredMode || justStarted) {
        nextTick(() => {
          speak(card.word.name);
        });
      }
    },
    { immediate: true }
  );

  const selectMode = (mode) => {
    studyMode.value = mode;
    modeSelected.value = true;
    localStorage.setItem('study-mode', mode);
    getStudySessionSyncChannel().publish({
      type: 'mode',
      mode,
      scope: getScope(),
      queueIds: getQueueIds(),
    });
    if (mode === 'choice') {
      // 将队列中所有单词传给选择题模式，用于本地生成干扰项
      choice.setQueueWords(queue.value.map((r) => r.word));
      choice.loadChoices();
    }
  };

  const fetchDue = async () => {
    loading.value = true;
    try {
      const saved = localStorage.getItem('study-session-progress');
      const scope = typeof route.query.scope === 'string' ? route.query.scope : '';
      const params = {
        ...(scope ? { scope } : {}),
      };
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
    const progress = resumeInfo.value;
    resumeInfo.value = null;
    currentIndex.value = progress.index;
    sessionStats.value = progress.stats || sessionStats.value;
    againCountMap.value = progress.againMap || {};
    studyMode.value = progress.mode || 'flashcard';
    modeSelected.value = true;
    if (studyMode.value === 'choice') {
      choice.setQueueWords(queue.value.map((r) => r.word));
      choice.loadChoices();
    }
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
    resetSession(true);
  };

  const replayAgainWords = () => {
    const ids = new Set(againWordIds.value);
    queue.value = originalQueue.value.filter((item) => ids.has(item.wordId));
    originalQueue.value = [...queue.value];
    resetSession(true);
  };

  /**
   * 继续复习：将未掌握词（again）排在最前，后跟全部原始词，进入重播模式。
   * 不管本轮是否全部掌握，都可以无限继续。
   */
  const continueReview = () => {
    const ids = new Set(againWordIds.value);
    const againWords = originalQueue.value.filter((item) => ids.has(item.wordId));
    const otherWords = originalQueue.value.filter((item) => !ids.has(item.wordId));
    queue.value = [...againWords, ...otherWords];
    originalQueue.value = [...queue.value];
    resetSession(true);
  };

  // 保存进度
  const saveProgress = () => {
    const data = {
      index: currentIndex.value,
      stats: sessionStats.value,
      againMap: againCountMap.value,
      mode: studyMode.value,
      scope: getScope(),
      queueIds: getQueueIds(),
    };
    localStorage.setItem('study-session-progress', JSON.stringify(data));
    getStudySessionSyncChannel().publish({ type: 'progress', data });
  };

  const clearProgress = () => {
    localStorage.removeItem('study-session-progress');
    getStudySessionSyncChannel().publish({
      type: 'cleared',
      scope: getScope(),
      queueIds: getQueueIds(),
    });
  };

  const applyRemoteProgress = (progress) => {
    if (!progress || progress.queueIds !== getQueueIds() || progress.scope !== getScope()) {
      return;
    }

    studyMode.value = progress.mode || studyMode.value;
    modeSelected.value = Boolean(progress.mode || modeSelected.value);
    sessionStats.value = progress.stats || { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
    againCountMap.value = progress.againMap || {};
    currentIndex.value = Math.min(
      Math.max(Number.isFinite(progress.index) ? progress.index : 0, 0),
      Math.max(queue.value.length - 1, 0)
    );
    finished.value = queue.value.length > 0 && progress.index >= queue.value.length;
    showAnswer.value = false;
    choice.resetChoice();
    spelling.resetSpelling();

    if (studyMode.value === 'choice') {
      choice.setQueueWords(queue.value.map((record) => record.word));
      choice.loadChoices();
    }
  };

  const handleStudySessionSync = (event) => {
    if (!event) return;

    if (event.type === 'mode') {
      if (event.queueIds !== getQueueIds() || event.scope !== getScope()) return;

      studyMode.value = event.mode || studyMode.value;
      modeSelected.value = Boolean(event.mode || modeSelected.value);

      if (studyMode.value === 'choice') {
        choice.setQueueWords(queue.value.map((record) => record.word));
        choice.loadChoices();
      }
      return;
    }

    if (event.type === 'progress') {
      applyRemoteProgress(event.data);
      return;
    }

    if (
      event.type === 'cleared' &&
      event.queueIds === getQueueIds() &&
      event.scope === getScope()
    ) {
      resumeInfo.value = null;
    }
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
      choice,
      spelling,
      saveProgress,
      incrementRevision,
    });

  const submitRating = async (quality) => {
    if (submitting.value) return;
    submitting.value = true;
    const wordId = currentCard.value.wordId;
    const revision = sessionRevision.value;
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    // 重播模式：只统计，不提交到服务器
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

  // 键盘快捷键
  const handleKeyDown = (e) => {
    if (!modeSelected.value || finished.value || !currentCard.value) return;
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // 闪卡模式
    if (studyMode.value === 'flashcard' && !inInput) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer.value) {
          flipCard();
        } else {
          speak(currentCard.value.word.name);
        }
      }
      if (showAnswer.value && !submitting.value) {
        if (e.key === '1') submitRating(1);
        else if (e.key === '2') submitRating(2);
        else if (e.key === '3') submitRating(3);
        else if (e.key === '4') submitRating(4);
      }
    }

    // 选择题模式（无文本输入框，不受 inInput 影响）
    if (studyMode.value === 'choice') {
      if (!choice.choiceAnswered.value) {
        const idx = { a: 0, 1: 0, b: 1, 2: 1, c: 2, 3: 2, d: 3, 4: 3 }[e.key.toLowerCase()];
        if (idx !== undefined && idx < choice.choiceOptions.value.length) {
          e.preventDefault();
          choice.handleChoice(idx);
        }
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        choice.choiceNext();
      }
    }

    // 拼写 & 听力模式
    if (studyMode.value === 'spelling' || studyMode.value === 'listening') {
      if (spelling.spellingAnswered.value) {
        // 答完后 Enter/Space 进入下一题
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          spelling.spellingNext();
        }
        return;
      }

      if (e.code === 'Enter') {
        e.preventDefault();
        spelling.checkSpelling();
        return;
      }

      // 听力模式：Space 始终重播发音，不向输入框写入空格
      if (studyMode.value === 'listening' && e.code === 'Space') {
        e.preventDefault();
        speak(currentCard.value.word.name);
      }
    }
  };

  onMounted(() => {
    fetchDue();
    stopSessionSync = getStudySessionSyncChannel().subscribe(handleStudySessionSync);
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    stopSessionSync();
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    // 状态
    loading,
    queue,
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
    // 错误单词
    hasAgainWords,
    againWordCount,
    originalQueueLength,
    // 方法
    selectMode,
    seekToIndex,
    applyResume,
    dismissResume,
    replayWithNewMode,
    replayAgainWords,
    continueReview,
    flipCard,
    submitRating,
    loadChoices: choice.loadChoices,
    handleChoice: choice.handleChoice,
    choiceNext: choice.choiceNext,
    checkSpelling: spelling.checkSpelling,
    showSpellingHint: spelling.showSpellingHint,
    spellingNext: spelling.spellingNext,
  };
}
