import { describe, it, expect } from 'vitest';
import {
  computeNextPassageReview,
  derivePassageStatus,
  PASSAGE_MASTERED_STAGE,
  PASSAGE_STATUS,
} from '../services/passage-review.js';

const TODAY = '2026-10-16';

describe('computeNextPassageReview', () => {
  it('第一次读完按自评决定起始档位', () => {
    expect(computeNextPassageReview(null, 'hard', TODAY)).toEqual({
      stage: 0,
      dueDate: '2026-10-17',
    });
    expect(computeNextPassageReview(null, 'good', TODAY)).toEqual({
      stage: 1,
      dueDate: '2026-10-19',
    });
    expect(computeNextPassageReview(null, 'easy', TODAY)).toEqual({
      stage: 2,
      dueDate: '2026-10-23',
    });
  });

  it('一般升一档，轻松升两档', () => {
    expect(computeNextPassageReview({ stage: 1 }, 'good', TODAY)).toEqual({
      stage: 2,
      dueDate: '2026-10-23',
    });
    expect(computeNextPassageReview({ stage: 1 }, 'easy', TODAY)).toEqual({
      stage: 3,
      dueDate: '2026-10-31',
    });
  });

  it('吃力降一档并在 1 天后重读，最低为 0', () => {
    expect(computeNextPassageReview({ stage: 3 }, 'hard', TODAY)).toEqual({
      stage: 2,
      dueDate: '2026-10-17',
    });
    expect(computeNextPassageReview({ stage: 0 }, 'hard', TODAY).stage).toBe(0);
  });

  it('最高档封顶为 60 天', () => {
    expect(computeNextPassageReview({ stage: 4 }, 'easy', TODAY)).toEqual({
      stage: PASSAGE_MASTERED_STAGE,
      dueDate: '2026-12-15',
    });
    expect(computeNextPassageReview({ stage: 99 }, 'good', TODAY).stage).toBe(
      PASSAGE_MASTERED_STAGE
    );
  });

  it('未知自评抛错', () => {
    expect(() => computeNextPassageReview(null, 'perfect', TODAY)).toThrow();
  });
});

describe('derivePassageStatus', () => {
  it('按未读、待重读、熟练、学习中的优先级判定', () => {
    expect(derivePassageStatus(null, TODAY)).toBe(PASSAGE_STATUS.UNREAD);
    expect(derivePassageStatus({ stage: 5, dueDate: TODAY }, TODAY)).toBe(PASSAGE_STATUS.DUE);
    expect(derivePassageStatus({ stage: 5, dueDate: '2026-11-01' }, TODAY)).toBe(
      PASSAGE_STATUS.MASTERED
    );
    expect(derivePassageStatus({ stage: 2, dueDate: '2026-11-01' }, TODAY)).toBe(
      PASSAGE_STATUS.LEARNING
    );
  });
});
