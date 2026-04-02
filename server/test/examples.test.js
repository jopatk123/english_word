/**
 * 测试：例句路由 CRUD
 *   - GET    /examples/?wordId=  获取例句列表
 *   - GET    /examples/:id       获取单个例句
 *   - POST   /examples/          创建例句
 *   - PUT    /examples/:id       编辑例句
 *   - DELETE /examples/:id       删除例句
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root, Word, WordRoot, Example } from '../models/index.js';
import examplesRouter from '../routes/examples.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.userId = userId; next(); });
  app.use('/examples', examplesRouter);
  return app;
};

let app;
let userId;
let wordId;
const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `extest_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  // 创建测试用词根和单词
  const root = await Root.create({ name: `exroot_${suf()}`, meaning: '词根', userId });
  const word = await Word.create({ name: `exword_${suf()}`, meaning: '含义' });
  await WordRoot.create({ wordId: word.id, rootId: root.id });
  wordId = word.id;
});

// ─── POST /examples/ ──────────────────────────────────────────
describe('POST /examples/', () => {
  it('成功创建例句', async () => {
    const res = await request(app)
      .post('/examples/')
      .send({ wordId, sentence: `She speaks English. ${suf()}`, translation: '她说英语。' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.wordId).toBe(wordId);
  });

  it('缺少必填字段返回错误', async () => {
    const res = await request(app)
      .post('/examples/')
      .send({ wordId, sentence: 'Only sentence.', /* missing translation */ });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('重复例句返回 400', async () => {
    const sentence = `Duplicate sentence. ${suf()}`;
    await request(app).post('/examples/').send({ wordId, sentence, translation: '翻译' });
    const res = await request(app).post('/examples/').send({ wordId, sentence, translation: '翻译' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/已存在/);
  });

  it('不存在的 wordId 返回错误', async () => {
    const res = await request(app)
      .post('/examples/')
      .send({ wordId: 99999999, sentence: 'Bad word.', translation: '翻译' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── GET /examples/ ───────────────────────────────────────────
describe('GET /examples/', () => {
  beforeAll(async () => {
    await request(app).post('/examples/').send({ wordId, sentence: `List test. ${suf()}`, translation: '列表测试' });
  });

  it('无 wordId 时返回所有该用户例句', async () => {
    const res = await request(app).get('/examples/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('指定 wordId 只返回该单词的例句', async () => {
    const res = await request(app).get(`/examples/?wordId=${wordId}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(ex => expect(ex.wordId).toBe(wordId));
  });
});

// ─── GET /examples/:id ────────────────────────────────────────
describe('GET /examples/:id', () => {
  let exampleId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/examples/')
      .send({ wordId, sentence: `Get one. ${suf()}`, translation: '获取单个' });
    exampleId = res.body.data.id;
  });

  it('返回正确的例句', async () => {
    const res = await request(app).get(`/examples/${exampleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(exampleId);
  });

  it('不存在的 id 返回错误', async () => {
    const res = await request(app).get('/examples/99999999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── PUT /examples/:id ────────────────────────────────────────
describe('PUT /examples/:id', () => {
  let exampleId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/examples/')
      .send({ wordId, sentence: `Update me. ${suf()}`, translation: '更新前' });
    exampleId = res.body.data.id;
  });

  it('成功更新例句', async () => {
    const res = await request(app)
      .put(`/examples/${exampleId}`)
      .send({ sentence: `Updated sentence. ${suf()}`, translation: '更新后' });
    expect(res.status).toBe(200);
    expect(res.body.data.translation).toBe('更新后');
  });

  it('缺少必填字段返回错误', async () => {
    const res = await request(app)
      .put(`/examples/${exampleId}`)
      .send({ sentence: 'Only sentence.' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── DELETE /examples/:id ─────────────────────────────────────
describe('DELETE /examples/:id', () => {
  it('成功删除例句', async () => {
    const created = await request(app)
      .post('/examples/')
      .send({ wordId, sentence: `Delete me. ${suf()}`, translation: '删除测试' });
    const exId = created.body.data.id;
    const res = await request(app).delete(`/examples/${exId}`);
    expect(res.status).toBe(200);
    const found = await Example.findByPk(exId);
    expect(found).toBeNull();
  });

  it('删除不存在的例句返回错误', async () => {
    const res = await request(app).delete('/examples/99999999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
