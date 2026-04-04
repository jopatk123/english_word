/**
 * 选择题模式状态与逻辑
 *
 * @param {Object} deps
 * @param {import('vue').ComputedRef} deps.currentCard       当前复习卡片
 * @param {Function}                 deps.submitReviewResult API 提交复习结果
 * @param {import('vue').Ref}        deps.sessionStats       会话统计（由 useStudySession 提供）
 * @param {Function}                 deps.handleAgain        重复出现单词
 * @param {Function}                 deps.advanceCard        向下一张卡片推进
 * @param {import('vue').Ref}        deps.isReplay           是否为重播模式
 */
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getQuizChoices } from '../api/index.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay }) {
  const choiceOptions = ref([]);
  const choiceSelected = ref(-1);
  const choiceAnswered = ref(false);

  // 缓存所有队列单词用于本地生成干扰项
  let queueWords = [];
  const setQueueWords = (words) => {
    queueWords = words;
  };

  const loadChoices = async () => {
    if (!currentCard.value) return;
    const wordId = currentCard.value.word.id;
    const meaning = currentCard.value.word.meaning;

    // 优先从本地队列取干扰项（排除当前词和含义完全相同的）
    const candidates = queueWords.filter(
      (w) => w.id !== wordId && w.meaning !== meaning
    );

    if (candidates.length >= 3) {
      const distractors = shuffle(candidates).slice(0, 3).map((w) => ({
        id: w.id,
        name: w.name,
        meaning: w.meaning,
      }));
      const correct = { id: wordId, name: currentCard.value.word.name, meaning };
      choiceOptions.value = shuffle([correct, ...distractors]);
    } else {
      // 队列太小，回退到 API
      try {
        const res = await getQuizChoices(wordId, 3);
        const all = [res.data.correct, ...res.data.distractors];
        choiceOptions.value = shuffle(all);
      } catch {
        choiceOptions.value = [{ id: wordId, meaning }];
      }
    }
  };

  const handleChoice = async (idx) => {
    choiceSelected.value = idx;
    choiceAnswered.value = true;
    const correct = choiceOptions.value[idx].id === currentCard.value.word.id;
    const quality = correct ? 3 : 1;
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    try {
      if (!isReplay?.value) {
        const { submitReviewResult } = await import('../api/index.js');
        await submitReviewResult(currentCard.value.wordId, quality);
      }
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;
      if (quality === 1) handleAgain(currentCard.value.wordId);
    } catch {
      ElMessage.error('提交结果失败');
    }
  };

  const choiceNext = () => {
    choiceSelected.value = -1;
    choiceAnswered.value = false;
    advanceCard();
  };

  const resetChoice = () => {
    choiceOptions.value = [];
    choiceSelected.value = -1;
    choiceAnswered.value = false;
  };

  return {
    choiceOptions,
    choiceSelected,
    choiceAnswered,
    loadChoices,
    handleChoice,
    choiceNext,
    resetChoice,
    setQueueWords,
  };
}
