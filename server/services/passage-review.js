import { addDays } from '../utils/srs.js';

export const PASSAGE_REVIEW_INTERVALS = Object.freeze([1, 3, 7, 15, 30, 60]);
export const PASSAGE_MASTERED_STAGE = PASSAGE_REVIEW_INTERVALS.length - 1;
export const PASSAGE_RATINGS = Object.freeze(['hard', 'good', 'easy']);

export const PASSAGE_STATUS = Object.freeze({
  UNREAD: 'unread',
  DUE: 'due',
  LEARNING: 'learning',
  MASTERED: 'mastered',
});

const FIRST_READ_STAGE = Object.freeze({ hard: 0, good: 1, easy: 2 });
const HARD_RETRY_DAYS = 1;

const clampStage = (stage) => Math.min(PASSAGE_MASTERED_STAGE, Math.max(0, stage));

/**
 * 计算读完一次后的档位和下次重读日期。
 * @param {{ stage: number } | null} previous 没有复习记录时传 null
 * @param {'hard'|'good'|'easy'} rating
 * @param {string} today YYYY-MM-DD（用户时区）
 */
export function computeNextPassageReview(previous, rating, today) {
  if (!PASSAGE_RATINGS.includes(rating)) {
    throw new Error(`未知的自评: ${rating}`);
  }

  if (!previous) {
    const stage = FIRST_READ_STAGE[rating];
    return { stage, dueDate: addDays(today, PASSAGE_REVIEW_INTERVALS[stage]) };
  }

  const current = clampStage(Number(previous.stage) || 0);
  if (rating === 'hard') {
    return { stage: clampStage(current - 1), dueDate: addDays(today, HARD_RETRY_DAYS) };
  }

  const stage = clampStage(current + (rating === 'easy' ? 2 : 1));
  return { stage, dueDate: addDays(today, PASSAGE_REVIEW_INTERVALS[stage]) };
}

/** 状态优先级：未读 > 待重读 > 熟练 > 学习中。 */
export function derivePassageStatus(review, today) {
  if (!review) return PASSAGE_STATUS.UNREAD;
  if (review.dueDate <= today) return PASSAGE_STATUS.DUE;
  if (review.stage >= PASSAGE_MASTERED_STAGE) return PASSAGE_STATUS.MASTERED;
  return PASSAGE_STATUS.LEARNING;
}
