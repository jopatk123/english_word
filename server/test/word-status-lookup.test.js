/**
 * 测试：POST /words/status-lookup 批量查询词库状态
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Word, WordReview } from '../models/index.js';
import wordsRouter from '../routes/words.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/words', wordsRouter);
  return app;
};

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);

let app;
let learningId;

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `wsl_${suf()}`, password: 'x' });
  const other = await User.create({ username: `wsm_${suf()}`, password: 'x' });
  app = buildApp(user.id);

  const learning = await Word.create({ name: 'pebble', meaning: '鹅卵石', userId: user.id });
  learningId = learning.id;
  await WordReview.create({
    userId: user.id,
    wordId: learning.id,
    status: 'learning',
    dueDate: '2099-01-01',
  });
  const known = await Word.create({ name: 'river', meaning: '河', userId: user.id });
  await WordReview.create({
    userId: user.id,
    wordId: known.id,
    status: 'known',
    dueDate: '2099-01-01',
  });
  await Word.create({ name: 'stone', meaning: '石头', userId: user.id });
  await Word.create({ name: 'cliff', meaning: '悬崖', userId: other.id });
});

describe('POST /words/status-lookup', () => {
  it('返回词库中存在的词及其状态，忽略其他用户和非法词', async () => {
    const res = await request(app)
      .post('/words/status-lookup')
      .send({ words: ['Pebble', 'river', 'stone', 'cliff', 'unknownword', '123', 'pebble'] });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual({
      pebble: { wordId: learningId, status: 'learning' },
      river: { wordId: expect.any(Number), status: 'known' },
      stone: { wordId: expect.any(Number), status: 'new' },
    });
  });

  it('空数组返回空结果', async () => {
    const res = await request(app).post('/words/status-lookup').send({ words: [] });
    expect(res.body.data.items).toEqual({});
  });

  it('参数不是数组或超过 500 个返回 400', async () => {
    expect((await request(app).post('/words/status-lookup').send({ words: 'x' })).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => `w${i}`);
    expect((await request(app).post('/words/status-lookup').send({ words: many })).status).toBe(
      400
    );
  });
});
