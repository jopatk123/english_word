/**
 * 测试：单词路由
 *   - GET  /words/      获取单词列表（含关键字 & rootId 过滤）
 *   - POST /words/      创建单词（含默认词根归入、重复词根追加）
 *   - GET  /words/:id   获取单词详情
 *   - PUT  /words/:id   更新单词
 *   - DELETE /words/:id 删除单词
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root, Word, WordRoot } from '../models/index.js';
import wordsRouter from '../routes/words.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';

// ─── 测试 App fixture ──────────────────────────────────────
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

let app;
let userId;
let rootId;
const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `wordtest_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  // 创建一个词根用于关联
  const root = await Root.create({ name: `wroot_${suf()}`, meaning: '词根', userId });
  rootId = root.id;
  // 确保默认词根存在
  await ensureDefaultRoot(userId);
});

// ─── 创建单词辅助 ─────────────────────────────────────────
const createWord = (wordSuf = suf()) =>
  request(app)
    .post('/words/')
    .send({ name: `word${wordSuf}`, meaning: '测试含义', rootIds: [rootId] });

// ─── POST /words/ ─────────────────────────────────────────
describe('POST /words/', () => {
  it('成功创建单词并关联词根', async () => {
    const res = await createWord();
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(Array.isArray(res.body.data.roots)).toBe(true);
    expect(res.body.data.roots.length).toBeGreaterThan(0);
  });

  it('缺少必填字段（name/meaning）返回 400+', async () => {
    const res = await request(app)
      .post('/words/')
      .send({ meaning: '缺 name', rootIds: [rootId] });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('不传 rootIds 时自动归入默认词根', async () => {
    const res = await request(app)
      .post('/words/')
      .send({ name: `noroot_${suf()}`, meaning: '无词根单词' });
    expect(res.status).toBe(200);
    expect(res.body.data.roots.length).toBeGreaterThan(0);
  });

  it('传入不存在的 rootId 返回错误', async () => {
    const res = await request(app)
      .post('/words/')
      .send({ name: `bad_${suf()}`, meaning: '测试', rootIds: [99999999] });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('同名单词重复添加相同词根返回 400', async () => {
    const name = `dup_${suf()}`;
    await request(app)
      .post('/words/')
      .send({ name, meaning: '含义', rootIds: [rootId] });
    const res = await request(app)
      .post('/words/')
      .send({ name, meaning: '含义', rootIds: [rootId] });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/已存在/);
  });
});

// ─── GET /words/ ──────────────────────────────────────────
describe('GET /words/', () => {
  beforeAll(async () => {
    // 预先创建几个单词
    await createWord();
    await createWord();
  });

  it('返回当前用户的单词列表', async () => {
    const res = await request(app).get('/words/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('每条结果含 exampleCount 字段', async () => {
    const res = await request(app).get('/words/');
    expect(res.body.data.every((w) => typeof w.exampleCount === 'number')).toBe(true);
  });

  it('keyword 搜索过滤', async () => {
    const uniqueName = `kwsearch_${suf()}`;
    await request(app)
      .post('/words/')
      .send({ name: uniqueName, meaning: '搜索测试', rootIds: [rootId] });
    const res = await request(app).get(`/words/?keyword=kwsearch`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((w) => w.name.includes('kwsearch'))).toBe(true);
  });

  it('rootId 过滤只返回该词根下的单词', async () => {
    const res = await request(app).get(`/words/?rootId=${rootId}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((w) => {
      expect(w.roots.some((r) => r.id === rootId)).toBe(true);
    });
  });
});

// ─── GET /words/:id ───────────────────────────────────────
describe('GET /words/:id', () => {
  let wordId;

  beforeAll(async () => {
    const res = await createWord();
    wordId = res.body.data.id;
  });

  it('返回正确的单词详情', async () => {
    const res = await request(app).get(`/words/${wordId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(wordId);
    expect(Array.isArray(res.body.data.roots)).toBe(true);
  });

  it('不存在的 id 返回错误', async () => {
    const res = await request(app).get('/words/99999999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── PUT /words/:id ───────────────────────────────────────
describe('PUT /words/:id', () => {
  let wordId;

  beforeAll(async () => {
    const res = await createWord();
    wordId = res.body.data.id;
  });

  it('成功更新单词含义和音标', async () => {
    // PUT 路由要求 name + meaning 均为必填
    const getRes = await request(app).get(`/words/${wordId}`);
    const currentName = getRes.body.data.name;
    const res = await request(app)
      .put(`/words/${wordId}`)
      .send({ name: currentName, meaning: '新含义', phonetic: '/njuː/' });
    expect(res.status).toBe(200);
    expect(res.body.data.meaning).toBe('新含义');
  });

  it('更新不存在的单词返回错误', async () => {
    const res = await request(app).put('/words/99999999').send({ meaning: '不存在' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── DELETE /words/:id ────────────────────────────────────
describe('DELETE /words/:id', () => {
  it('成功删除单词', async () => {
    const res = await createWord();
    const wordId = res.body.data.id;
    const delRes = await request(app).delete(`/words/${wordId}`);
    expect(delRes.status).toBe(200);
    const found = await Word.findByPk(wordId);
    expect(found).toBeNull();
  });

  it('删除其他用户的单词返回错误', async () => {
    // 创建另一个用户及其词根/单词
    const otherUser = await User.create({ username: `otherword_${suf()}`, password: 'x' });
    const otherRoot = await Root.create({
      name: `or_${suf()}`,
      meaning: 'x',
      userId: otherUser.id,
    });
    const otherWord = await Word.create({ name: `ow_${suf()}`, meaning: 'x' });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const res = await request(app).delete(`/words/${otherWord.id}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
