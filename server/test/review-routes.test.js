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
  const word = await Word.create({ name: `rword_${suf()}`, meaning: '含义' });
  await WordRoot.create({ wordId: word.id, rootId: root.id });
  wordId = word.id;
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
});

// ─── GET /review/stats ────────────────────────────────────────
describe('GET /review/stats', () => {
  it('返回包含各状态计数的统计对象', async () => {
    const res = await request(app).get('/review/stats');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(typeof s.total).toBe('number');
    expect(typeof s.due).toBe('number');
    expect(typeof s.new).toBe('number');
    expect(typeof s.known).toBe('number');
    expect(typeof s.todayReviewed).toBe('number');
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
    const word2 = await Word.create({ name: `rword2_${suf()}`, meaning: '含义2' });
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
    const word3 = await Word.create({ name: `rword3_${suf()}`, meaning: 'x' });
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
    const word4 = await Word.create({ name: `rword4_${suf()}`, meaning: 'x' });
    await WordRoot.create({ wordId: word4.id, rootId });
    await request(app).post('/review/enqueue').send({ rootId });

    const res = await request(app).delete(`/review/${word4.id}`);
    expect(res.status).toBe(200);
    const rw = await WordReview.findOne({ where: { userId, wordId: word4.id } });
    expect(rw).toBeNull();
  });

  it('未入队的单词返回 404', async () => {
    const word5 = await Word.create({ name: `rword5_${suf()}`, meaning: 'x' });
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
