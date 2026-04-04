import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult, getQuizChoices } from '../api/index.js';
import { useSpeech } from '../utils/speech.js';

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

  // 选择题状态
  const choiceOptions = ref([]);
  const choiceSelected = ref(-1);
  const choiceAnswered = ref(false);

  // 拼写 & 听力模式状态
  const spellingInput = ref('');
  const spellingAnswered = ref(false);
  const spellingCorrect = ref(false);
  const spellingHintLevel = ref(0);

  const { speak } = useSpeech();

  const spellingHint = computed(() => {
    if (!currentCard.value) return '输入单词...';
    const name = currentCard.value.word.name;
    if (spellingHintLevel.value === 0) return '输入单词拼写...';
    if (spellingHintLevel.value === 1)
      return `${name[0]}${'_'.repeat(name.length - 1)} (${name.length}个字母)`;
    return `${name.slice(0, Math.ceil(name.length / 2))}${'_'.repeat(name.length - Math.ceil(name.length / 2))}`;
  });

  const currentCard = computed(() => {
    if (currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value];
    }
    return null;
  });

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

  const againWordIds = computed(() => Object.keys(againCountMap.value).map(Number));
  const hasAgainWords = computed(() => againWordIds.value.length > 0);
  const againWordCount = computed(() => againWordIds.value.length);

  const selectMode = (mode) => {
    studyMode.value = mode;
    modeSelected.value = true;
    localStorage.setItem('study-mode', mode);
    if (mode === 'choice') loadChoices();
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
    if (studyMode.value === 'choice') loadChoices();
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

  const advanceCard = () => {
    currentIndex.value++;
    showAnswer.value = false;
    choiceAnswered.value = false;
    choiceSelected.value = -1;
    spellingInput.value = '';
    spellingAnswered.value = false;
    spellingCorrect.value = false;
    spellingHintLevel.value = 0;

    if (currentIndex.value >= queue.value.length) {
      finished.value = true;
      clearProgress();
    } else {
      saveProgress();
      if (studyMode.value === 'choice') loadChoices();
    }
  };

  const handleAgain = (wordId) => {
    const count = againCountMap.value[wordId] || 0;
    if (count < MAX_AGAIN_PER_WORD) {
      againCountMap.value[wordId] = count + 1;
      queue.value.push({ ...currentCard.value });
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

  // ===== 选择题模式 =====
  const loadChoices = async () => {
    if (!currentCard.value) return;
    try {
      const res = await getQuizChoices(currentCard.value.word.id, 3);
      const all = [res.data.correct, ...res.data.distractors];
      choiceOptions.value = all.sort(() => Math.random() - 0.5);
    } catch {
      choiceOptions.value = [
        { id: currentCard.value.word.id, meaning: currentCard.value.word.meaning },
      ];
    }
  };

  const handleChoice = async (idx) => {
    choiceSelected.value = idx;
    choiceAnswered.value = true;
    const correct = choiceOptions.value[idx].id === currentCard.value.word.id;
    const quality = correct ? 3 : 1;
    submitting.value = true;
    try {
      await submitReviewResult(currentCard.value.wordId, quality);
      const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;

      if (quality === 1) handleAgain(currentCard.value.wordId);
    } catch {
      ElMessage.error('提交结果失败');
    } finally {
      submitting.value = false;
    }
  };

  const choiceNext = () => advanceCard();

  // ===== 拼写 & 听力模式 =====
  const checkSpelling = async () => {
    if (!spellingInput.value.trim() || spellingAnswered.value) return;
    spellingAnswered.value = true;
    spellingCorrect.value =
      spellingInput.value.trim().toLowerCase() === currentCard.value.word.name.toLowerCase();

    const quality = spellingCorrect.value ? 3 : 1;
    submitting.value = true;
    try {
      await submitReviewResult(currentCard.value.wordId, quality);
      const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;

      if (quality === 1) handleAgain(currentCard.value.wordId);
    } catch {
      ElMessage.error('提交结果失败');
    } finally {
      submitting.value = false;
    }
  };

  const showSpellingHint = () => {
    spellingHintLevel.value = Math.min(spellingHintLevel.value + 1, 2);
  };

  const spellingNext = () => advanceCard();

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
    // 选择题
    choiceOptions,
    choiceSelected,
    choiceAnswered,
    // 拼写 & 听力
    spellingInput,
    spellingAnswered,
    spellingCorrect,
    spellingHint,
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
    loadChoices,
    handleChoice,
    choiceNext,
    checkSpelling,
    showSpellingHint,
    spellingNext,
  };
}
