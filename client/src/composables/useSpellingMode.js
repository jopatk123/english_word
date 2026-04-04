/**
 * 拼写 & 听力模式状态与逻辑
 *
 * @param {Object} deps
 * @param {import('vue').ComputedRef} deps.currentCard       当前复习卡片
 * @param {import('vue').Ref}        deps.sessionStats       会话统计（由 useStudySession 提供）
 * @param {Function}                 deps.handleAgain        重复出现单词
 * @param {Function}                 deps.advanceCard        向下一张卡片推进
 * @param {import('vue').Ref}        deps.isReplay           是否为重播模式
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { submitReviewResult } from '../api/index.js';

export function useSpellingMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay }) {
  const spellingInput = ref('');
  const spellingAnswered = ref(false);
  const spellingCorrect = ref(false);
  const spellingHintLevel = ref(0);

  const spellingHint = computed(() => {
    if (!currentCard.value) return '输入单词...';
    const name = currentCard.value.word.name;
    if (spellingHintLevel.value === 0) return '输入单词拼写...';
    if (spellingHintLevel.value === 1)
      return `${name[0]}${'_'.repeat(name.length - 1)} (${name.length}个字母)`;
    return `${name.slice(0, Math.ceil(name.length / 2))}${'_'.repeat(name.length - Math.ceil(name.length / 2))}`;
  });

  const checkSpelling = async () => {
    if (!spellingInput.value.trim() || spellingAnswered.value) return;
    spellingAnswered.value = true;
    spellingCorrect.value =
      spellingInput.value.trim().toLowerCase() === currentCard.value.word.name.toLowerCase();

    const quality = spellingCorrect.value ? 3 : 1;
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    try {
      if (!isReplay?.value) {
        await submitReviewResult(currentCard.value.wordId, quality);
      }
      sessionStats.value.total++;
      sessionStats.value[qualityMap[quality]]++;
      if (quality === 1) handleAgain(currentCard.value.wordId);
    } catch {
      ElMessage.error('提交结果失败');
    }
  };

  const showSpellingHint = () => {
    spellingHintLevel.value = Math.min(spellingHintLevel.value + 1, 2);
  };

  const spellingNext = () => {
    spellingInput.value = '';
    spellingAnswered.value = false;
    spellingCorrect.value = false;
    spellingHintLevel.value = 0;
    advanceCard();
  };

  const resetSpelling = () => {
    spellingInput.value = '';
    spellingAnswered.value = false;
    spellingCorrect.value = false;
    spellingHintLevel.value = 0;
  };

  return {
    spellingInput,
    spellingAnswered,
    spellingCorrect,
    spellingHint,
    spellingHintLevel,
    checkSpelling,
    showSpellingHint,
    spellingNext,
    resetSpelling,
  };
}
