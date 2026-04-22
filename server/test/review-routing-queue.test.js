import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { User, Root, Word, WordRoot, WordReview } from '../models/index.js';
import { buildReviewApp, createReviewFixture, createTestSuffix } from './review-test-utils.js';

let fixture;

beforeEach(async () => {
  fixture = await createReviewFixture();
});

describe('GET /review/quiz-choices/:wordId', () => {
  it('只返回当前用户自己的正确项和干扰项', async () => {
    const isolatedUser = await User.create({ username: `quiz_user_${createTestSuffix()}`, password: 'x' });
    const isolatedRoot = await Root.create({
      name: `quiz_root_${createTestSuffix()}`,
      meaning: '隔离词根',
      userId: isolatedUser.id,
    });
    const isolatedWord = await Word.create({
      name: `quiz_target_${createTestSuffix()}`,
      meaning: '目标释义',
      userId: isolatedUser.id,
    });
    const isolatedDistractor = await Word.create({
      name: `quiz_local_${createTestSuffix()}`,
      meaning: '本地干扰项',
      userId: isolatedUser.id,
    });
    const otherUser = await User.create({ username: `quiz_other_${createTestSuffix()}`, password: 'x' });
    const otherRoot = await Root.create({
      name: `quiz_other_root_${createTestSuffix()}`,
      meaning: '他人词根',
      userId: otherUser.id,
    });
    const otherWord = await Word.create({
      name: `quiz_other_word_${createTestSuffix()}`,
      meaning: '他人释义',
      userId: otherUser.id,
    });

    await WordRoot.create({ wordId: isolatedWord.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: isolatedDistractor.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const isolatedApp = buildReviewApp(isolatedUser.id);
    const res = await request(isolatedApp).get(`/review/quiz-choices/${isolatedWord.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.correct.id).toBe(isolatedWord.id);
    expect(res.body.data.distractors.some((item) => item.id === isolatedDistractor.id)).toBe(true);
    expect(res.body.data.distractors.some((item) => item.id === otherWord.id)).toBe(false);
  });
});

describe('POST /review/enqueue', () => {
  it('成功将词根下单词加入队列', async () => {
    const res = await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('added');
    expect(res.body.data.added).toBeGreaterThan(0);
  });

  it('重复加入同一词根时 added=0', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    const res = await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    expect(res.status).toBe(200);
    expect(res.body.data.added).toBe(0);
  });

  it('不存在的词根返回 404', async () => {
    const res = await request(fixture.app).post('/review/enqueue').send({ rootId: 99999999 });
    expect(res.status).toBe(404);
  });

  it('缺少 rootId 返回 400', async () => {
    const res = await request(fixture.app).post('/review/enqueue').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /review/due', () => {
  it('返回今日待复习列表', async () => {
    const res = await request(fixture.app).get('/review/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('未来到期的单词不会进入今日待复习列表', async () => {
    const futureWord = await Word.create({ name: `future_${createTestSuffix()}`, meaning: '未来到期', userId: fixture.userId });
    await WordRoot.create({ wordId: futureWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: futureWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-10',
      reviewCount: 1,
    });

    const res = await request(fixture.app).get('/review/due');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).not.toContain(futureWord.id);
  });

  it('limit=1 只返回 1 条', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    const res = await request(fixture.app).get('/review/due?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('新词 quality=3 后会等待 10 分钟才重新进入待复习', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T10:00:00Z'));

    try {
      const stepWord = await Word.create({ name: `step_${createTestSuffix()}`, meaning: '短间隔', userId: fixture.userId });
      await WordRoot.create({ wordId: stepWord.id, rootId: fixture.rootId });

      await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
      const resultRes = await request(fixture.app).post(`/review/${stepWord.id}/result`).send({ quality: 3 });
      expect(resultRes.status).toBe(200);
      expect(resultRes.body.data.interval).toBe(0);

      const immediateRes = await request(fixture.app).get('/review/due');
      const immediateIds = immediateRes.body.data.map((item) => item.wordId);
      expect(immediateIds).not.toContain(stepWord.id);

      vi.setSystemTime(new Date('2026-04-09T10:10:01Z'));
      const laterRes = await request(fixture.app).get('/review/due');
      const laterIds = laterRes.body.data.map((item) => item.wordId);
      expect(laterIds).toContain(stepWord.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scope=learning 仅返回未掌握单词', async () => {
    const knownWord = await Word.create({ name: `known_${createTestSuffix()}`, meaning: '已掌握词', userId: fixture.userId });
    const learningWord = await Word.create({
      name: `learning_${createTestSuffix()}`,
      meaning: '学习词',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 30,
      easeFactor: 2.8,
      dueDate: '2099-01-01',
      reviewCount: 5,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 3,
      easeFactor: 2.5,
      dueDate: '2099-01-01',
      reviewCount: 2,
    });

    const res = await request(fixture.app).get('/review/due?scope=learning');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(learningWord.id);
    expect(ids).not.toContain(knownWord.id);
  });

  it('scope=known 仅返回已掌握单词', async () => {
    const knownWord = await Word.create({ name: `known_only_${createTestSuffix()}`, meaning: '已掌握', userId: fixture.userId });
    const learningWord = await Word.create({
      name: `learning_only_${createTestSuffix()}`,
      meaning: '学习中',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 40,
      easeFactor: 2.9,
      dueDate: '2099-01-02',
      reviewCount: 6,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'learning',
      interval: 1,
      easeFactor: 2.3,
      dueDate: '2099-01-02',
      reviewCount: 1,
    });

    const res = await request(fixture.app).get('/review/due?scope=known');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(knownWord.id);
    expect(ids).not.toContain(learningWord.id);
  });

  it('scope=today-reviewed 仅返回今日已复习单词', async () => {
    const reviewedWord = await Word.create({
      name: `reviewed_${createTestSuffix()}`,
      meaning: '今日复习',
      userId: fixture.userId,
    });
    const untouchedWord = await Word.create({
      name: `untouched_${createTestSuffix()}`,
      meaning: '未复习',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: reviewedWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: untouchedWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: reviewedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: new Date(),
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: untouchedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: null,
    });

    const res = await request(fixture.app).get('/review/due?scope=today-reviewed');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(reviewedWord.id);
    expect(ids).not.toContain(untouchedWord.id);
  });

  it('scope=continue 时未掌握单词排在已掌握前面', async () => {
    const knownWord = await Word.create({
      name: `continue_known_${createTestSuffix()}`,
      meaning: '已掌握',
      userId: fixture.userId,
    });
    const learningWord = await Word.create({
      name: `continue_learning_${createTestSuffix()}`,
      meaning: '学习中',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 50,
      easeFactor: 3,
      dueDate: '2099-01-04',
      reviewCount: 8,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 4,
      easeFactor: 2.4,
      dueDate: '2099-01-04',
      reviewCount: 2,
    });

    const res = await request(fixture.app).get('/review/due?scope=continue');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids.indexOf(learningWord.id)).toBeLessThan(ids.indexOf(knownWord.id));
  });
});