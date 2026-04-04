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
import { useSpeech } from '../utils/speech.js';

/**
 * 计算两个字符串的 Levenshtein 编辑距离。
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function useSpellingMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay }) {
  const { speak } = useSpeech();
  const spellingInput = ref('');
  const spellingAnswered = ref(false);
  const spellingCorrect = ref(false);
  const spellingHard = ref(false); // 接近正确（编辑距离小，但不完全相同）
  const spellingHintLevel = ref(0);

  const spellingHint = computed(() => {
    if (!currentCard.value) return '输入单词...';
    const name = currentCard.value.word.name;
    if (spellingHintLevel.value === 0) return '输入单词拼写...';
    if (spellingHintLevel.value === 1)
      return `${name[0]}${'_'.repeat(name.length - 1)} (${name.length}个字母)`;
    const half = Math.ceil(name.length / 2);
    if (spellingHintLevel.value === 2)
      return `${name.slice(0, half)}${'_'.repeat(name.length - half)}`;
    const twoThird = Math.ceil((name.length * 2) / 3);
    return `${name.slice(0, twoThird)}${'_'.repeat(name.length - twoThird)}`;
  });

  const checkSpelling = async () => {
    if (!spellingInput.value.trim() || spellingAnswered.value) return;
    spellingAnswered.value = true;
    const input = spellingInput.value.trim().toLowerCase();
    const answer = currentCard.value.word.name.toLowerCase();
    spellingCorrect.value = input === answer;

    // 模糊评分：完全正确=3，接近正确(编辑距离≤2且不超过单词长度20%)=2，完全错误=1
    let quality;
    if (spellingCorrect.value) {
      quality = 3;
      spellingHard.value = false;
    } else {
      const dist = levenshtein(input, answer);
      const threshold = Math.max(1, Math.ceil(answer.length * 0.2));
      quality = dist <= threshold ? 2 : 1;
      spellingHard.value = quality === 2;
    }

    // 答题后自动朗读单词
    speak(currentCard.value.word.name);

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
    spellingHintLevel.value = Math.min(spellingHintLevel.value + 1, 3);
  };

  const spellingNext = () => {
    spellingInput.value = '';
    spellingAnswered.value = false;
    spellingCorrect.value = false;
    spellingHard.value = false;
    spellingHintLevel.value = 0;
    advanceCard();
  };

  const resetSpelling = () => {
    spellingInput.value = '';
    spellingAnswered.value = false;
    spellingCorrect.value = false;
    spellingHard.value = false;
    spellingHintLevel.value = 0;
  };

  return {
    spellingInput,
    spellingAnswered,
    spellingCorrect,
    spellingHard,
    spellingHint,
    spellingHintLevel,
    checkSpelling,
    showSpellingHint,
    spellingNext,
    resetSpelling,
  };
}
