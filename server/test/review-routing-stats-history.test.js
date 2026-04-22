import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Root, User, Word, WordRoot, WordReview } from '../models/index.js';
import { buildReviewApp, createReviewFixture, createTestSuffix } from './review-test-utils.js';

let fixture;

beforeEach(async () => {
  fixture = await createReviewFixture();
});

describe('GET /review/stats', () => {
  it('按时区统计今日已复习，避免跨时区漏算', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T01:00:00Z'));

    try {
      const isolatedUser = await User.create({ username: `stats_user_${createTestSuffix()}`, password: 'x' });
      const isolatedApp = buildReviewApp(isolatedUser.id);
      const reviewedWord = await Word.create({
        name: `stats_today_${createTestSuffix()}`,
        meaning: '今日已复习测试',
        userId: isolatedUser.id,
      });
      await WordReview.create({
        userId: isolatedUser.id,
        wordId: reviewedWord.id,
        status: 'review',
        interval: 6,
        easeFactor: 2.5,
        dueDate: '2026-04-09',
        reviewCount: 1,
        lastReviewedAt: new Date('2026-04-07T17:00:00Z'),
      });

      const res = await request(isolatedApp).get('/review/stats?tz=Asia/Shanghai');
      expect(res.status).toBe(200);
      expect(res.body.data.todayReviewed).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('返回用户视角统计，且总数等于学习中+已掌握', async () => {
    const reviewWord = await Word.create({
      name: `stats_review_${createTestSuffix()}`,
      meaning: '复习中',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: reviewWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: reviewWord.id,
      status: 'review',
      interval: 6,
      easeFactor: 2.6,
      dueDate: '2099-01-05',
      reviewCount: 4,
    });

    const res = await request(fixture.app).get('/review/stats');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(typeof s.total).toBe('number');
    expect(typeof s.due).toBe('number');
    expect(typeof s.new).toBe('number');
    expect(typeof s.learning).toBe('number');
    expect(typeof s.known).toBe('number');
    expect(typeof s.todayReviewed).toBe('number');
    expect(s).not.toHaveProperty('weekDue');
    expect(s.total).toBe(s.learning + s.known);
    expect(s.new).toBe(0);
    expect(s.learning).toBeGreaterThan(0);
  });

  it('今日稍后到期的短间隔单词不会提前计入 due', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T11:00:00Z'));

    try {
      const isolatedUser = await User.create({ username: `stats_short_user_${createTestSuffix()}`, password: 'x' });
      const isolatedApp = buildReviewApp(isolatedUser.id);
      const futureDueWord = await Word.create({
        name: `stats_short_${createTestSuffix()}`,
        meaning: '分钟级待复习',
        userId: isolatedUser.id,
      });
      const isolatedRoot = await Root.create({
        name: `stats_short_root_${createTestSuffix()}`,
        meaning: '短间隔词根',
        userId: isolatedUser.id,
      });
      await WordRoot.create({ wordId: futureDueWord.id, rootId: isolatedRoot.id });
      await WordReview.create({
        userId: isolatedUser.id,
        wordId: futureDueWord.id,
        status: 'learning',
        interval: 0,
        easeFactor: 2.5,
        dueDate: '2026-04-09',
        dueAt: new Date('2026-04-09T11:10:00Z'),
        reviewCount: 1,
      });

      const res = await request(isolatedApp).get('/review/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.todayDue).toBe(0);
      expect(res.body.data.due).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GET /review/roots-progress', () => {
  it('返回词根学习进度列表', async () => {
    const res = await request(fixture.app).get('/review/roots-progress');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const r = res.body.data.find((item) => item.id === fixture.rootId);
    expect(r).toBeTruthy();
    expect(typeof r.enrolled).toBe('number');
  });
});

describe('GET /review/history', () => {
  it('返回学习历史列表（默认 30 天）', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    await request(fixture.app).post(`/review/${fixture.wordId}/result`).send({ quality: 3 });
    const res = await request(fixture.app).get('/review/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('days 参数限制查询范围', async () => {
    const res = await request(fixture.app).get('/review/history?days=7');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /review/history/summary', () => {
  it('返回包含 daily 数组和 streak 的摘要对象', async () => {
    await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    await request(fixture.app).post(`/review/${fixture.wordId}/result`).send({ quality: 3 });
    const res = await request(fixture.app).get('/review/history/summary');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(Array.isArray(s.daily)).toBe(true);
    expect(typeof s.streak).toBe('number');
    expect(typeof s.totalReviews).toBe('number');
  });
});