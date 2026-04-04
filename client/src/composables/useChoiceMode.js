/**
 * 选择题模式状态与逻辑
 *
 * @param {Object} deps
 * @param {import('vue').ComputedRef} deps.currentCard       当前复习卡片
 * @param {Function}                 deps.submitReviewResult API 提交复习结果
 * @param {import('vue').Ref}        deps.sessionStats       会话统计（由 useStudySession 提供）
 * @param {Function}                 deps.handleAgain        重复出现单词
 * @param {Function}                 deps.advanceCard        向下一张卡片推进
 */
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getQuizChoices } from '../api/index.js';

export function useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard }) {
  const choiceOptions = ref([]);
  const choiceSelected = ref(-1);
  const choiceAnswered = ref(false);

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
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    try {
      const { submitReviewResult } = await import('../api/index.js');
      await submitReviewResult(currentCard.value.wordId, quality);
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
  };
}
