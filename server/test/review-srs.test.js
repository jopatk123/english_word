/**
 * 测试：SRS 算法（当前版本）、日期工具与 WordReview 数据库操作
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDB, sequelize, Word, User, WordReview } from '../models/index.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';
import { getNextReview, addDays, MAX_INTERVAL } from '../utils/srs.js';

// ============================================================
beforeAll(async () => {
  // initDB 是幂等的，确保表已存在即可
  await initDB();
  // 防止重复创建用户
  const existing = await User.findOne({ where: { username: 'srs_testuser' } });
  if (!existing) {
    await User.create({ username: 'srs_testuser', password: 'hashed_pw_srs' });
  }
});

afterAll(async () => {
  await sequelize.close();
});

// ======================== SRS 纯函数测试 ========================

describe('SRS 算法 getNextReview（当前版本）', () => {
  it('quality=1(again): interval=0，当日内再复习', () => {
    const result = getNextReview(1, 10, 2.5, 'review');
    expect(result.interval).toBe(0);
    expect(result.status).toBe('learning');
    expect(result.easeFactor).toBeCloseTo(2.3, 5);
  });

  it('quality=1 easeF 不低于 1.3', () => {
    const result = getNextReview(1, 1, 1.3, 'learning');
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    expect(result.easeFactor).toBe(1.3);
  });

  it('quality=2(hard): 新词 interval=1, status=learning', () => {
    const result = getNextReview(2, 0, 2.5, 'new');
    expect(result.interval).toBe(1);
    expect(result.status).toBe('learning');
  });

  it('quality=2(hard): 老词 interval=ceil(currentInterval * 1.2)', () => {
    const result = getNextReview(2, 5, 2.5, 'review');
    expect(result.interval).toBe(Math.ceil(5 * 1.2)); // 6
  });

  it('quality=3(good): 新词 interval=1, status=learning', () => {
    const result = getNextReview(3, 0, 2.5, 'new');
    expect(result.interval).toBe(1);
    expect(result.status).toBe('learning');
  });

  it('quality=3(good): 老词 interval=ceil(currentInterval * easeFactor)', () => {
    const result = getNextReview(3, 5, 2.5, 'review');
    expect(result.interval).toBe(Math.ceil(5 * 2.5)); // 13
  });

  it('quality=4(easy): 新词 interval=4, 跳过学习阶段', () => {
    const result = getNextReview(4, 0, 2.5, 'new');
    expect(result.interval).toBe(4);
    expect(result.status).toBe('review');
  });

  it('quality=4(easy): 老词大幅增加间隔 + easeFactor 增加', () => {
    const result = getNextReview(4, 10, 2.5, 'review');
    expect(result.interval).toBe(Math.ceil(10 * 2.5 * 1.3)); // 33
    expect(result.easeFactor).toBeCloseTo(2.65, 5);
  });

  it('interval >= 21 天时 status 为 known', () => {
    const result = getNextReview(4, 15, 2.5, 'review');
    expect(result.status).toBe('known');
    expect(result.interval).toBeGreaterThanOrEqual(21);
  });

  it('interval 不超过 MAX_INTERVAL=365', () => {
    const result = getNextReview(4, 300, 2.5, 'review');
    expect(result.interval).toBe(MAX_INTERVAL);
  });

  it('quality=1 连续触发 easeF 下降但不低于 1.3', () => {
    let ease = 2.5;
    for (let i = 0; i < 20; i++) {
      const r = getNextReview(1, 0, ease, 'learning');
      ease = r.easeFactor;
    }
    expect(ease).toBe(1.3);
  });

  // 学习阶段测试
  it('learning + quality=3: 毕业到 review, interval=3', () => {
    const result = getNextReview(3, 1, 2.5, 'learning');
    expect(result.interval).toBe(3);
    expect(result.status).toBe('review');
  });

  it('learning + quality=2: 保持 learning, interval=1', () => {
    const result = getNextReview(2, 1, 2.5, 'learning');
    expect(result.interval).toBe(1);
    expect(result.status).toBe('learning');
  });
});

// ======================== 日期工具测试 ========================

describe('日期工具 addDays', () => {
  it('addDays 正确计算日期偏移', () => {
    expect(addDays('2026-03-17', 7)).toBe('2026-03-24');
    expect(addDays('2026-03-17', 0)).toBe('2026-03-17');
    expect(addDays('2026-03-28', 5)).toBe('2026-04-02');
  });
});

// ======================== WordReview 数据库操作测试 ========================

describe('WordReview 学习队列数据库操作', () => {
  let testUserId;
  let testWordId;

  beforeAll(async () => {
    const user = await User.findOne({ where: { username: 'srs_testuser' } });
    testUserId = user.id;
    const root = await ensureDefaultRoot(testUserId);
    // 避免重复创建
    const existingWords = await root.getWords({ where: { name: 'srs_test_word' } });
    if (existingWords.length) {
      testWordId = existingWords[0].id;
    } else {
      const word = await Word.create({
        name: 'srs_test_word',
        meaning: 'SRS测试单词',
        userId: testUserId,
      });
      await word.addRoot(root);
      testWordId = word.id;
    }
    // 确保无残留记录
    await WordReview.destroy({ where: { userId: testUserId, wordId: testWordId } });
  });

  it('加入学习队列后 status=new，dueDate=today，interval=0', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const review = await WordReview.create({
      userId: testUserId,
      wordId: testWordId,
      status: 'new',
      interval: 0,
      easeFactor: 2.5,
      dueDate: today,
      reviewCount: 0,
    });
    expect(review.status).toBe('new');
    expect(review.dueDate).toBe(today);
    expect(review.interval).toBe(0);
    expect(review.reviewCount).toBe(0);
  });

  it('提交 quality=3(good) 后新词进入学习阶段 interval=1，status=learning', async () => {
    const review = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    const { interval, easeFactor, status } = getNextReview(
      3,
      review.interval,
      review.easeFactor,
      review.status
    );
    const today = new Date().toISOString().slice(0, 10);
    const nextDue = addDays(today, interval);

    await review.update({
      status,
      interval,
      easeFactor,
      dueDate: nextDue,
      reviewCount: review.reviewCount + 1,
      lastReviewedAt: new Date(),
    });

    const updated = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    expect(updated.interval).toBe(1);
    expect(updated.status).toBe('learning');
    expect(updated.reviewCount).toBe(1);
    expect(updated.dueDate).toBe(nextDue);
  });

  it('提交 quality=1(again) 后 interval=0，status=learning', async () => {
    const review = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    const { interval, easeFactor, status } = getNextReview(
      1,
      review.interval,
      review.easeFactor,
      review.status
    );
    const today = new Date().toISOString().slice(0, 10);
    const nextDue = addDays(today, interval);

    await review.update({
      status,
      interval,
      easeFactor,
      dueDate: nextDue,
      reviewCount: review.reviewCount + 1,
      lastReviewedAt: new Date(),
    });

    const updated = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    expect(updated.interval).toBe(0);
    expect(updated.status).toBe('learning');
  });

  it('单词可以被暂停后不出现在学习队列', async () => {
    const review = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    await review.update({ paused: true });

    const activeReviews = await WordReview.findAll({
      where: { userId: testUserId, paused: false },
    });
    const pausedWord = activeReviews.find((r) => r.wordId === testWordId);
    expect(pausedWord).toBeUndefined();
  });

  it('恢复暂停后可以正常查到', async () => {
    const review = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    await review.update({ paused: false });

    const updated = await WordReview.findOne({ where: { userId: testUserId, wordId: testWordId } });
    expect(updated.paused).toBe(false);
  });
});
