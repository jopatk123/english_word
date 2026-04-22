import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Word, WordRoot, WordReview } from '../models/index.js';
import { createReviewFixture, createTestSuffix } from './review-test-utils.js';

let fixture;

beforeEach(async () => {
  fixture = await createReviewFixture();
});

describe('POST /review/:wordId/result', () => {
  it('quality=3 提交成功，并写入短间隔 dueAt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T09:00:00Z'));

    try {
      await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
      const res = await request(fixture.app).post(`/review/${fixture.wordId}/result`).send({ quality: 3 });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('interval');
      expect(res.body.data.interval).toBe(0);
      expect(res.body.data.status).toBe('learning');
      expect(res.body.data.dueAt).toBeTruthy();
      expect(new Date(res.body.data.dueAt).toISOString()).toBe('2026-04-09T09:10:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('quality=4 但成功次数不足时不会直接升为 known', async () => {
    const promotedWord = await Word.create({
      name: `promoted_${createTestSuffix()}`,
      meaning: '长间隔但次数不足',
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
      successCount: 1,
    });

    const res = await request(fixture.app).post(`/review/${promotedWord.id}/result`).send({ quality: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('review');
    expect(res.body.data.reviewCount).toBe(11);
    expect(res.body.data.successCount).toBe(2);
  });

  it('成功次数达到阈值后可升为 known', async () => {
    const maturedWord = await Word.create({
      name: `matured_${createTestSuffix()}`,
      meaning: '成功次数达标',
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
    });

    const res = await request(fixture.app).post(`/review/${maturedWord.id}/result`).send({ quality: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('known');
    expect(res.body.data.successCount).toBe(3);
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
    });

    const res = await request(fixture.app).post(`/review/${knownWord.id}/result`).send({ quality: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('learning');
    expect(res.body.data.interval).toBe(0);
    expect(res.body.data.reviewCount).toBe(7);
    expect(res.body.data.successCount).toBe(3);
    expect(res.body.data.dueAt).toBeTruthy();
  });

  it('quality 超出范围返回 400', async () => {
    const res = await request(fixture.app).post(`/review/${fixture.wordId}/result`).send({ quality: 5 });
    expect(res.status).toBe(400);
  });

  it('未入队的单词返回 404', async () => {
    const word2 = await Word.create({ name: `rword2_${createTestSuffix()}`, meaning: '含义2', userId: fixture.userId });
    await WordRoot.create({ wordId: word2.id, rootId: fixture.rootId });
    const res = await request(fixture.app).post(`/review/${word2.id}/result`).send({ quality: 3 });
    expect(res.status).toBe(404);
  });
});

describe('POST /review/:wordId/pause', () => {
  it('切换暂停状态', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    const res = await request(fixture.app).post(`/review/${fixture.wordId}/pause`).send({});
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId: fixture.userId, wordId: fixture.wordId } });
    expect(typeof rw.paused).toBe('boolean');
  });

  it('未入队的单词返回 404', async () => {
    const word3 = await Word.create({ name: `rword3_${createTestSuffix()}`, meaning: 'x', userId: fixture.userId });
    await WordRoot.create({ wordId: word3.id, rootId: fixture.rootId });
    const res = await request(fixture.app).post(`/review/${word3.id}/pause`).send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /review/:wordId/reset', () => {
  it('重置后 status=new interval=0', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    await request(fixture.app).post(`/review/${fixture.wordId}/result`).send({ quality: 4 });
    const res = await request(fixture.app).post(`/review/${fixture.wordId}/reset`).send({});
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId: fixture.userId, wordId: fixture.wordId } });
    expect(rw.status).toBe('new');
    expect(rw.interval).toBe(0);
    expect(rw.successCount).toBe(0);
    expect(rw.dueAt).toBeTruthy();
  });
});

describe('DELETE /review/:wordId', () => {
  it('成功从队列移除单词', async () => {
    const word4 = await Word.create({ name: `rword4_${createTestSuffix()}`, meaning: 'x', userId: fixture.userId });
    await WordRoot.create({ wordId: word4.id, rootId: fixture.rootId });
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });

    const res = await request(fixture.app).delete(`/review/${word4.id}`);
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId: fixture.userId, wordId: word4.id } });
    expect(rw).toBeNull();
  });

  it('未入队的单词返回 404', async () => {
    const word5 = await Word.create({ name: `rword5_${createTestSuffix()}`, meaning: 'x', userId: fixture.userId });
    await WordRoot.create({ wordId: word5.id, rootId: fixture.rootId });
    const res = await request(fixture.app).delete(`/review/${word5.id}`);
    expect(res.status).toBe(404);
  });
});