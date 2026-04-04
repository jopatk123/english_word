import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult } from '../api/index.js';
import { useSpeech } from '../utils/speech.js';
import { useChoiceMode } from './useChoiceMode.js';
import { useSpellingMode } from './useSpellingMode.js';

export function useStudySession() {
  const route = useRoute();

  const loading = ref(true);
  const queue = ref([]);
  const originalQueue = ref([]);
  const currentIndex = ref(0);
  const showAnswer = ref(false);
  const submitting = ref(false);
  const finished = ref(false);
  const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const MAX_AGAIN_PER_WORD = 3;
  const againCountMap = ref({});
  const resumeInfo = ref(null);

  // 学习模式
  const studyMode = ref('flashcard');
  const modeSelected = ref(false);
  const modeNames = { flashcard: '闪卡', choice: '选择题', spelling: '拼写', listening: '听力' };

  const { speak } = useSpeech();

  const currentCard = computed(() => {
    if (currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value];
    }
    return null;
  });

  const againWordIds = computed(() => Object.keys(againCountMap.value).map(Number));
  const hasAgainWords = computed(() => againWordIds.value.length > 0);
  const againWordCount = computed(() => againWordIds.value.length);

  const handleAgain = (wordId) => {
    const count = againCountMap.value[wordId] || 0;
    if (count < MAX_AGAIN_PER_WORD) {
      againCountMap.value[wordId] = count + 1;
      queue.value.push({ ...currentCard.value });
    }
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
  const choice = useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard });
  const spelling = useSpellingMode({ currentCard, sessionStats, handleAgain, advanceCard });

  // 自动朗读：进入卡片时朗读一次，翻牌时再朗读一次
  watch(
    [currentCard, studyMode, modeSelected],
    ([card, mode, selected], previousValues = []) => {
      const [prevCard, prevMode, prevSelected] = previousValues;

      if (!card) return;
      if (mode !== 'flashcard' || !selected) return;

      const isNewCard = card !== prevCard;
      const justEnteredFlashcard = mode === 'flashcard' && prevMode !== 'flashcard';
      const justStarted = selected && !prevSelected;

      if (isNewCard || justEnteredFlashcard || justStarted) {
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
    if (mode === 'choice') choice.loadChoices();
  };

  const fetchDue = async () => {
    loading.value = true;
    try {
      const saved = localStorage.getItem('study-session-progress');
      const advanceDays = Math.min(parseInt(route.query.advance) || 0, 30);
      const res = await getReviewDue(advanceDays > 0 ? { advance: advanceDays } : {});
      queue.value = res.data || [];
      originalQueue.value = [...queue.value];

      if (saved && queue.value.length > 0) {
        try {
          const progress = JSON.parse(saved);
          if (progress.queueIds && queue.value.length > 0) {
            const currentIds = queue.value.map((r) => r.wordId).join(',');
            if (
              progress.queueIds === currentIds &&
              progress.index > 0 &&
              progress.index < queue.value.length
            ) {
              resumeInfo.value = progress;
            }
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
    if (studyMode.value === 'choice') choice.loadChoices();
  };

  const dismissResume = () => {
    resumeInfo.value = null;
    clearProgress();
  };

  const resetSession = () => {
    currentIndex.value = 0;
    finished.value = false;
    modeSelected.value = false;
    showAnswer.value = false;
    sessionStats.value = { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
    againCountMap.value = {};
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

  // 保存进度
  const saveProgress = () => {
    const data = {
      index: currentIndex.value,
      stats: sessionStats.value,
      againMap: againCountMap.value,
      mode: studyMode.value,
      queueIds: queue.value.map((r) => r.wordId).join(','),
    };
    localStorage.setItem('study-session-progress', JSON.stringify(data));
  };

  const clearProgress = () => {
    localStorage.removeItem('study-session-progress');
  };

  const flipCard = () => {
    showAnswer.value = true;
    if (currentCard.value) {
      speak(currentCard.value.word.name);
    }
  };

  const submitRating = async (quality) => {
    if (submitting.value) return;
    submitting.value = true;
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    try {
      await submitReviewResult(currentCard.value.wordId, quality);
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;
      if (quality === 1) handleAgain(currentCard.value.wordId);
      advanceCard();
    } catch {
      ElMessage.error('提交复习结果失败');
    } finally {
      submitting.value = false;
    }
  };

  // 键盘快捷键
  const handleKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (
      studyMode.value === 'flashcard' &&
      modeSelected.value &&
      !finished.value &&
      currentCard.value
    ) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer.value) {
          flipCard();
        } else if (currentCard.value) {
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
  };

  onMounted(() => {
    fetchDue();
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
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
    spellingHint: spelling.spellingHint,
    // 错误单词
    hasAgainWords,
    againWordCount,
    // 方法
    selectMode,
    applyResume,
    dismissResume,
    replayWithNewMode,
    replayAgainWords,
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
