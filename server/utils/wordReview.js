import { WordReview } from '../models/index.js';
import { buildDueSchedule } from './srs.js';

export function buildInitialWordReviewDefaults(userId, wordId, timezone, now = new Date()) {
  const { dueAt, dueDate } = buildDueSchedule(0, timezone, now);

  return {
    userId,
    wordId,
    status: 'new',
    interval: 0,
    easeFactor: 2.5,
    dueDate,
    dueAt,
    reviewCount: 0,
    successCount: 0,
    perfectStreakCount: 0,
  };
}

export async function ensureWordReview(userId, wordId, options = {}) {
  const { timezone, transaction, now = new Date() } = options;

  return WordReview.findOrCreate({
    where: { userId, wordId },
    defaults: buildInitialWordReviewDefaults(userId, wordId, timezone, now),
    ...(transaction ? { transaction } : {}),
  });
}