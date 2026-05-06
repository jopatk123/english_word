import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Word, WordRoot, WordReview } from '../models/index.js';
import { createReviewFixture, createTestSuffix } from './review-test-utils.js';

let fixture;

beforeEach(async () => {
  fixture = await createReviewFixture();
});

describe('POST /review/:wordId/result', () => {
  it('quality=3 提交成功，并写入拉开的短间隔 dueAt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T09:00:00Z'));

    try {
      const res = await request(fixture.app)
        .post(`/review/${fixture.wordId}/result`)
        .send({ quality: 3 });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('interval');
      expect(res.body.data.interval).toBe(0);
      expect(res.body.data.status).toBe('learning');
      expect(res.body.data.perfectStreakCount).toBe(0);
      expect(res.body.data.dueAt).toBeTruthy();
      expect(new Date(res.body.data.dueAt).toISOString()).toBe('2026-04-09T09:30:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('连续 4 分不足 3 次时不会直接升为 known', async () => {
    const promotedWord = await Word.create({
      name: `promoted_${createTestSuffix()}`,
      meaning: '连续 4 分不足',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: promotedWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: promotedWord.id,
      status: 'review',
      interval: 30,
      easeFactor: 2.5,
      dueDate: '2099-01-11',
      reviewCount: 10,
      successCount: 10,
      perfectStreakCount: 1,
    });

    const res = await request(fixture.app)
      .post(`/review/${promotedWord.id}/result`)
      .send({ quality: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('review');
    expect(res.body.data.reviewCount).toBe(11);
    expect(res.body.data.successCount).toBe(11);
    expect(res.body.data.perfectStreakCount).toBe(2);
  });

  it('连续 4 分达到阈值后可升为 known', async () => {
    const maturedWord = await Word.create({
      name: `matured_${createTestSuffix()}`,
      meaning: '连续 4 分达标',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: maturedWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: maturedWord.id,
      status: 'review',
      interval: 30,
      easeFactor: 2.5,
      dueDate: '2099-01-12',
      reviewCount: 5,
      successCount: 2,
      perfectStreakCount: 2,
    });

    const res = await request(fixture.app)
      .post(`/review/${maturedWord.id}/result`)
      .send({ quality: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('known');
    expect(res.body.data.successCount).toBe(3);
    expect(res.body.data.perfectStreakCount).toBe(3);
  });

  it('已掌握单词再次答错后会回到 learning 且不增加成功次数', async () => {
    const knownWord = await Word.create({
      name: `known_fallback_${createTestSuffix()}`,
      meaning: '已掌握回退',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 45,
      easeFactor: 2.8,
      dueDate: '2099-01-13',
      reviewCount: 6,
      successCount: 3,
      perfectStreakCount: 3,
    });

    const res = await request(fixture.app)
      .post(`/review/${knownWord.id}/result`)
      .send({ quality: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('learning');
    expect(res.body.data.interval).toBe(0);
    expect(res.body.data.reviewCount).toBe(7);
    expect(res.body.data.successCount).toBe(3);
    expect(res.body.data.perfectStreakCount).toBe(0);
    expect(res.body.data.dueAt).toBeTruthy();
  });

  it('已掌握单词 quality=3 仍保持 known', async () => {
    const knownWord = await Word.create({
      name: `known_review_${createTestSuffix()}`,
      meaning: '已掌握回退到复习',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 20,
      easeFactor: 2.6,
      dueDate: '2099-01-14',
      reviewCount: 6,
      successCount: 6,
      perfectStreakCount: 3,
    });

    const res = await request(fixture.app)
      .post(`/review/${knownWord.id}/result`)
      .send({ quality: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('known');
    expect(res.body.data.interval).toBe(Math.ceil(20 * 2.6));
    expect(res.body.data.successCount).toBe(7);
    expect(res.body.data.perfectStreakCount).toBe(0);
  });

  it('quality 超出范围返回 400', async () => {
    const res = await request(fixture.app)
      .post(`/review/${fixture.wordId}/result`)
      .send({ quality: 5 });
    expect(res.status).toBe(400);
  });

  it('缺失复习记录的单词会自动补齐后提交成功', async () => {
    const word2 = await Word.create({
      name: `rword2_${createTestSuffix()}`,
      meaning: '含义2',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: word2.id, rootId: fixture.rootId });
    const res = await request(fixture.app).post(`/review/${word2.id}/result`).send({ quality: 3 });
    expect(res.status).toBe(200);

    const review = await WordReview.findOne({
      where: { userId: fixture.userId, wordId: word2.id },
    });
    expect(review).toBeTruthy();
    expect(review.status).toBe('learning');
  });
});

describe('已移除的手动复习管理接口', () => {
  it('pause/reset/remove 接口均返回 404', async () => {
    const pauseRes = await request(fixture.app).post(`/review/${fixture.wordId}/pause`).send({});
    const resetRes = await request(fixture.app).post(`/review/${fixture.wordId}/reset`).send({});
    const removeRes = await request(fixture.app).delete(`/review/${fixture.wordId}`);

    expect(pauseRes.status).toBe(404);
    expect(resetRes.status).toBe(404);
    expect(removeRes.status).toBe(404);
  });
});
