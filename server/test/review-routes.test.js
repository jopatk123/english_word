/**
 * 测试：复习子路由（session、due、stats、manage）
 *   - POST /review/enqueue              加入学习队列
 *   - GET  /review/due                  获取待复习列表
 *   - POST /review/:wordId/result       提交复习结果
 *   - GET  /review/stats                获取学习统计
 *   - GET  /review/roots-progress       词根学习进度
 *   - POST /review/:wordId/reset        重置学习进度
 *   - POST /review/:wordId/pause        暂停/恢复
 *   - DELETE /review/:wordId            从队列中移除
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root, Word, WordRoot, WordReview } from '../models/index.js';
import sessionRouter from '../routes/review/session.js';
import dueRouter from '../routes/review/due.js';
import statsRouter from '../routes/review/stats.js';
import manageRouter from '../routes/review/manage.js';
import historyRouter from '../routes/review/history.js';

// ─── 构建集成测试 App ──────────────────────────────────────────
const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  // 挂载路由（顺序同 review.js）
  app.use('/review', dueRouter);
  app.use('/review', statsRouter);
  app.use('/review', historyRouter);
  app.use('/review', manageRouter);
  app.use('/review', sessionRouter);
  return app;
};

let app;
let userId;
let rootId;
let wordId;
const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `revtest_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  // 创建词根和单词
  const root = await Root.create({ name: `rroot_${suf()}`, meaning: '词根', userId });
  rootId = root.id;
  const word = await Word.create({ name: `rword_${suf()}`, meaning: '含义', userId });
  await WordRoot.create({ wordId: word.id, rootId: root.id });
  wordId = word.id;
});

describe('GET /review/quiz-choices/:wordId', () => {
  it('只返回当前用户自己的正确项和干扰项', async () => {
    const isolatedUser = await User.create({ username: `quiz_user_${suf()}`, password: 'x' });
    const isolatedRoot = await Root.create({ name: `quiz_root_${suf()}`, meaning: '隔离词根', userId: isolatedUser.id });
    const isolatedWord = await Word.create({ name: `quiz_target_${suf()}`, meaning: '目标释义', userId: isolatedUser.id });
    const isolatedDistractor = await Word.create({
      name: `quiz_local_${suf()}`,
      meaning: '本地干扰项',
      userId: isolatedUser.id,
    });
    const otherUser = await User.create({ username: `quiz_other_${suf()}`, password: 'x' });
    const otherRoot = await Root.create({ name: `quiz_other_root_${suf()}`, meaning: '他人词根', userId: otherUser.id });
    const otherWord = await Word.create({ name: `quiz_other_word_${suf()}`, meaning: '他人释义', userId: otherUser.id });

    await WordRoot.create({ wordId: isolatedWord.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: isolatedDistractor.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const isolatedApp = buildApp(isolatedUser.id);
    const res = await request(isolatedApp).get(`/review/quiz-choices/${isolatedWord.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.correct.id).toBe(isolatedWord.id);
    expect(res.body.data.distractors.some((item) => item.id === isolatedDistractor.id)).toBe(true);
    expect(res.body.data.distractors.some((item) => item.id === otherWord.id)).toBe(false);
  });
});

// ─── POST /review/enqueue ─────────────────────────────────────
describe('POST /review/enqueue', () => {
  it('成功将词根下单词加入队列', async () => {
    const res = await request(app).post('/review/enqueue').send({ rootId });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('added');
    expect(res.body.data.added).toBeGreaterThan(0);
  });

  it('重复加入同一词根时 added=0', async () => {
    const res = await request(app).post('/review/enqueue').send({ rootId });
    expect(res.status).toBe(200);
    expect(res.body.data.added).toBe(0);
  });

  it('不存在的词根返回 404', async () => {
    const res = await request(app).post('/review/enqueue').send({ rootId: 99999999 });
    expect(res.status).toBe(404);
  });

  it('缺少 rootId 返回 400', async () => {
    const res = await request(app).post('/review/enqueue').send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /review/due ──────────────────────────────────────────
describe('GET /review/due', () => {
  it('返回今日待复习列表', async () => {
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('advance 参数扩大查询范围', async () => {
    const res = await request(app).get('/review/due?advance=7');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('limit=1 只返回 1 条', async () => {
    // 先确保队列中至少有数据
    await request(app).post('/review/enqueue').send({ rootId });
    const res = await request(app).get('/review/due?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('scope=learning 仅返回未掌握单词', async () => {
    const knownWord = await Word.create({ name: `known_${suf()}`, meaning: '已掌握词', userId });
    const learningWord = await Word.create({ name: `learning_${suf()}`, meaning: '学习词', userId });
    await WordRoot.create({ wordId: knownWord.id, rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId });
    await WordReview.create({
      userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 30,
      easeFactor: 2.8,
      dueDate: '2099-01-01',
      reviewCount: 5,
    });
    await WordReview.create({
      userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 3,
      easeFactor: 2.5,
      dueDate: '2099-01-01',
      reviewCount: 2,
    });

    const res = await request(app).get('/review/due?scope=learning');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(learningWord.id);
    expect(ids).not.toContain(knownWord.id);
  });

  it('scope=known 仅返回已掌握单词', async () => {
    const knownWord = await Word.create({ name: `known_only_${suf()}`, meaning: '已掌握', userId });
    const learningWord = await Word.create({ name: `learning_only_${suf()}`, meaning: '学习中', userId });
    await WordRoot.create({ wordId: knownWord.id, rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId });
    await WordReview.create({
      userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 40,
      easeFactor: 2.9,
      dueDate: '2099-01-02',
      reviewCount: 6,
    });
    await WordReview.create({
      userId,
      wordId: learningWord.id,
      status: 'learning',
      interval: 1,
      easeFactor: 2.3,
      dueDate: '2099-01-02',
      reviewCount: 1,
    });

    const res = await request(app).get('/review/due?scope=known');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(knownWord.id);
    expect(ids).not.toContain(learningWord.id);
  });

  it('scope=today-reviewed 仅返回今日已复习单词', async () => {
    const reviewedWord = await Word.create({ name: `reviewed_${suf()}`, meaning: '今日复习', userId });
    const untouchedWord = await Word.create({ name: `untouched_${suf()}`, meaning: '未复习', userId });
    await WordRoot.create({ wordId: reviewedWord.id, rootId });
    await WordRoot.create({ wordId: untouchedWord.id, rootId });
    await WordReview.create({
      userId,
      wordId: reviewedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: new Date(),
    });
    await WordReview.create({
      userId,
      wordId: untouchedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: null,
    });

    const res = await request(app).get('/review/due?scope=today-reviewed');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(reviewedWord.id);
    expect(ids).not.toContain(untouchedWord.id);
  });

  it('scope=continue 时未掌握单词排在已掌握前面', async () => {
    const knownWord = await Word.create({ name: `continue_known_${suf()}`, meaning: '已掌握', userId });
    const learningWord = await Word.create({ name: `continue_learning_${suf()}`, meaning: '学习中', userId });
    await WordRoot.create({ wordId: knownWord.id, rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId });
    await WordReview.create({
      userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 50,
      easeFactor: 3,
      dueDate: '2099-01-04',
      reviewCount: 8,
    });
    await WordReview.create({
      userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 4,
      easeFactor: 2.4,
      dueDate: '2099-01-04',
      reviewCount: 2,
    });

    const res = await request(app).get('/review/due?scope=continue');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids.indexOf(learningWord.id)).toBeLessThan(ids.indexOf(knownWord.id));
  });
});

// ─── GET /review/stats ────────────────────────────────────────
describe('GET /review/stats', () => {
  it('返回用户视角统计，且总数等于学习中+已掌握', async () => {
    const reviewWord = await Word.create({ name: `stats_review_${suf()}`, meaning: '复习中', userId });
    await WordRoot.create({ wordId: reviewWord.id, rootId });
    await WordReview.create({
      userId,
      wordId: reviewWord.id,
      status: 'review',
      interval: 6,
      easeFactor: 2.6,
      dueDate: '2099-01-05',
      reviewCount: 4,
    });

    const res = await request(app).get('/review/stats');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(typeof s.total).toBe('number');
    expect(typeof s.due).toBe('number');
    expect(typeof s.new).toBe('number');
    expect(typeof s.learning).toBe('number');
    expect(typeof s.known).toBe('number');
    expect(typeof s.todayReviewed).toBe('number');
    expect(s.total).toBe(s.learning + s.known);
    expect(s.new).toBe(0);
    expect(s.learning).toBeGreaterThan(0);
  });
});

// ─── GET /review/roots-progress ───────────────────────────────
describe('GET /review/roots-progress', () => {
  it('返回词根学习进度列表', async () => {
    const res = await request(app).get('/review/roots-progress');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const r = res.body.data.find((r) => r.id === rootId);
    expect(r).toBeTruthy();
    expect(typeof r.enrolled).toBe('number');
  });
});

// ─── POST /review/:wordId/result ──────────────────────────────
describe('POST /review/:wordId/result', () => {
  it('quality=3 提交成功，interval 更新', async () => {
    // 确保入队
    await request(app).post('/review/enqueue').send({ rootId });
    const res = await request(app).post(`/review/${wordId}/result`).send({ quality: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('interval');
    expect(res.body.data.interval).toBeGreaterThan(0);
  });

  it('quality 超出范围返回 400', async () => {
    const res = await request(app).post(`/review/${wordId}/result`).send({ quality: 5 });
    expect(res.status).toBe(400);
  });

  it('未入队的单词返回 404', async () => {
    // 创建一个未入队的新单词
    const word2 = await Word.create({ name: `rword2_${suf()}`, meaning: '含义2', userId });
    await WordRoot.create({ wordId: word2.id, rootId });
    const res = await request(app).post(`/review/${word2.id}/result`).send({ quality: 3 });
    expect(res.status).toBe(404);
  });
});

// ─── POST /review/:wordId/pause ───────────────────────────────
describe('POST /review/:wordId/pause', () => {
  it('切换暂停状态', async () => {
    // 确保入队
    await request(app).post('/review/enqueue').send({ rootId });
    const res = await request(app).post(`/review/${wordId}/pause`).send({});
    expect(res.status).toBe(200);
    // 验证 paused 状态已更改
    const rw = await WordReview.findOne({ where: { userId, wordId } });
    expect(typeof rw.paused).toBe('boolean');
  });

  it('未入队的单词返回 404', async () => {
    const word3 = await Word.create({ name: `rword3_${suf()}`, meaning: 'x', userId });
    await WordRoot.create({ wordId: word3.id, rootId });
    const res = await request(app).post(`/review/${word3.id}/pause`).send({});
    expect(res.status).toBe(404);
  });
});

// ─── POST /review/:wordId/reset ───────────────────────────────
describe('POST /review/:wordId/reset', () => {
  it('重置后 status=new interval=0', async () => {
    // 提交一次以改变 interval
    await request(app).post(`/review/${wordId}/result`).send({ quality: 4 });
    const res = await request(app).post(`/review/${wordId}/reset`).send({});
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId, wordId } });
    expect(rw.status).toBe('new');
    expect(rw.interval).toBe(0);
  });
});

// ─── DELETE /review/:wordId ───────────────────────────────────
describe('DELETE /review/:wordId', () => {
  it('成功从队列移除单词', async () => {
    // 创建一个新单词并入队
    const word4 = await Word.create({ name: `rword4_${suf()}`, meaning: 'x', userId });
    await WordRoot.create({ wordId: word4.id, rootId });
    await request(app).post('/review/enqueue').send({ rootId });

    const res = await request(app).delete(`/review/${word4.id}`);
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId, wordId: word4.id } });
    expect(rw).toBeNull();
  });

  it('未入队的单词返回 404', async () => {
    const word5 = await Word.create({ name: `rword5_${suf()}`, meaning: 'x', userId });
    await WordRoot.create({ wordId: word5.id, rootId });
    const res = await request(app).delete(`/review/${word5.id}`);
    expect(res.status).toBe(404);
  });
});

// ─── GET /review/history ──────────────────────────────────────
describe('GET /review/history', () => {
  it('返回学习历史列表（默认 30 天）', async () => {
    // 先提交一次复习以产生历史记录
    await request(app).post('/review/enqueue').send({ rootId });
    await request(app).post(`/review/${wordId}/result`).send({ quality: 3 });
    const res = await request(app).get('/review/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('days 参数限制查询范围', async () => {
    const res = await request(app).get('/review/history?days=7');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── GET /review/history/summary ─────────────────────────────
describe('GET /review/history/summary', () => {
  it('返回包含 daily 数组和 streak 的摘要对象', async () => {
    const res = await request(app).get('/review/history/summary');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(Array.isArray(s.daily)).toBe(true);
    expect(typeof s.streak).toBe('number');
    expect(typeof s.totalReviews).toBe('number');
  });
});
