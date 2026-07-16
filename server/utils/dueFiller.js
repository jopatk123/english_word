import { WordReview } from '../models/index.js';
import { REVIEW_STATUS } from './srs.js';

// 当"今日到期 + 超期"数量少于"学习中"单词的 1/3 时，
// 从"学习中"单词里补足到至少 1/3，优先选取最近复习时间更早的单词。
export const MIN_DUE_RATIO = 1 / 3;

// 学习中单词数 = 总单词数 - 已掌握单词数（与 stats.js 的口径保持一致）
export async function countLearning(userId) {
  const [total, known] = await Promise.all([
    WordReview.count({ where: { userId } }),
    WordReview.count({ where: { userId, status: REVIEW_STATUS.KNOWN } }),
  ]);
  return Math.max(total - known, 0);
}

// 计算补足后应有的最小 due 数量：ceil(learningCount / 3)
// learningCount 为 0 时返回 0，避免空词库也强制塞词
export function computeMinDueCount(learningCount) {
  if (learningCount <= 0) return 0;
  return Math.ceil(learningCount * MIN_DUE_RATIO);
}
