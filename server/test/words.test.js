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
import {
  initDB,
  User,
  Root,
  Word,
  WordRoot,
  WordReview,
  ReviewHistory,
  Example,
} from '../models/index.js';
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
  it('成功创建单词并关联词根，同时自动加入复习', async () => {
    const res = await createWord();
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(Array.isArray(res.body.data.roots)).toBe(true);
    expect(res.body.data.roots.length).toBeGreaterThan(0);

    const review = await WordReview.findOne({ where: { userId, wordId: res.body.data.id } });
    expect(review).toBeTruthy();
    expect(review.status).toBe('new');
    expect(review.interval).toBe(0);
    expect(review.dueAt).toBeTruthy();
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

  it('同名单词追加新词根时，若尚未入复习也会自动入队', async () => {
    const name = `enroll_existing_${suf()}`;
    const secondRoot = await Root.create({ name: `wroot_${suf()}`, meaning: '第二词根', userId });
    const word = await Word.create({ name, meaning: '测试含义', userId });
    await WordRoot.create({ wordId: word.id, rootId });

    const res = await request(app)
      .post('/words/')
      .send({ name, meaning: '测试含义', rootIds: [secondRoot.id] });

    expect(res.status).toBe(200);

    const review = await WordReview.findOne({ where: { userId, wordId: word.id } });
    expect(review).toBeTruthy();
    expect(review.status).toBe('new');
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
    expect(typeof res.body.total).toBe('number');
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

  it('keyword 也能按单词含义搜索', async () => {
    const wordName = `meaningword_${suf()}`;
    await request(app)
      .post('/words/')
      .send({ name: wordName, meaning: '中文单词含义命中测试', rootIds: [rootId] });
    const res = await request(app).get('/words/?keyword=中文单词含义');
    expect(res.status).toBe(200);
    expect(res.body.data.some((w) => w.name === wordName)).toBe(true);
  });

  it('rootId 过滤只返回该词根下的单词', async () => {
    const res = await request(app).get(`/words/?rootId=${rootId}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((w) => {
      expect(w.roots.some((r) => r.id === rootId)).toBe(true);
    });
  });

  it('limit/offset 分页正常工作', async () => {
    const res = await request(app).get('/words/?limit=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.data.length);
  });

  it('maxExamples 只返回例句数不超过上限的单词', async () => {
    const fewName = `fewex_${suf()}`;
    const manyName = `manyex_${suf()}`;
    const few = await request(app)
      .post('/words/')
      .send({ name: fewName, meaning: '少例句', rootIds: [rootId] });
    const many = await request(app)
      .post('/words/')
      .send({ name: manyName, meaning: '多例句', rootIds: [rootId] });
    await Example.create({
      wordId: many.body.data.id,
      sentence: `The ${manyName} is used twice.`,
      translation: '一',
    });
    await Example.create({
      wordId: many.body.data.id,
      sentence: `Another ${manyName} sentence.`,
      translation: '二',
    });

    const res = await request(app).get(`/words/?keyword=fewex_&maxExamples=0`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((w) => w.id === few.body.data.id)).toBe(true);
    expect(res.body.data.some((w) => w.id === many.body.data.id)).toBe(false);
    expect(res.body.data.every((w) => w.exampleCount <= 0)).toBe(true);
  });

  it('minExamples 只返回达到下限的单词', async () => {
    const name = `minex_${suf()}`;
    const created = await request(app)
      .post('/words/')
      .send({ name, meaning: '够例句', rootIds: [rootId] });
    await Example.create({
      wordId: created.body.data.id,
      sentence: `Use ${name} once.`,
      translation: '用一次',
    });
    const hit = await request(app).get(`/words/?keyword=${name}&minExamples=1`);
    const miss = await request(app).get(`/words/?keyword=${name}&minExamples=2`);
    expect(hit.body.data.some((w) => w.id === created.body.data.id)).toBe(true);
    expect(miss.body.data.some((w) => w.id === created.body.data.id)).toBe(false);
  });

  it('onlyDefaultRoot 只返回仅挂「未分类」的单词', async () => {
    const name = `onlydef_${suf()}`;
    const created = await request(app).post('/words/').send({ name, meaning: '无明确词根' });
    const res = await request(app).get(`/words/?keyword=${name}&onlyDefaultRoot=1`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(created.body.data.id);
    expect(res.body.data[0].roots).toHaveLength(1);
    expect(res.body.data[0].roots[0].name).toBe('未分类');

    const classified = await request(app).get(`/words/?keyword=word&onlyDefaultRoot=1`);
    expect(classified.body.data.every((w) => w.roots.length === 1)).toBe(true);
  });

  it('hasImage=0/1 按是否有记忆图过滤', async () => {
    const noImg = await createWord();
    const withImg = await createWord();
    await Word.update({ imageExt: 'jpg' }, { where: { id: withImg.body.data.id } });

    const none = await request(app).get(
      `/words/?keyword=${encodeURIComponent(noImg.body.data.name)}&hasImage=0`
    );
    const some = await request(app).get(
      `/words/?keyword=${encodeURIComponent(withImg.body.data.name)}&hasImage=1`
    );
    expect(none.body.data.some((w) => w.id === noImg.body.data.id)).toBe(true);
    expect(some.body.data.some((w) => w.id === withImg.body.data.id)).toBe(true);
    expect(some.body.data.every((w) => w.hasImage === true)).toBe(true);
  });

  it('status 与 scope=learning 可过滤复习状态', async () => {
    const knownWord = await createWord();
    await WordReview.update(
      { status: 'known' },
      { where: { userId, wordId: knownWord.body.data.id } }
    );
    const knownRes = await request(app).get(
      `/words/?keyword=${encodeURIComponent(knownWord.body.data.name)}&status=known`
    );
    expect(knownRes.body.data.some((w) => w.id === knownWord.body.data.id)).toBe(true);
    expect(knownRes.body.data[0].status).toBe('known');

    const learningRes = await request(app).get(
      `/words/?keyword=${encodeURIComponent(knownWord.body.data.name)}&scope=learning`
    );
    expect(learningRes.body.data.some((w) => w.id === knownWord.body.data.id)).toBe(false);
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
    expect(res.body.data.hasImage).toBe(false);
    expect(res.body.data).not.toHaveProperty('imageExt');
    expect(res.body.data).not.toHaveProperty('examples');
    expect(res.body.data.status).toBe('new');
  });

  it('includeExamples=1 返回有上限的例句列表', async () => {
    await Example.create({
      wordId,
      sentence: `See ${wordId} in a sentence.`,
      translation: '例句',
    });
    const res = await request(app).get(`/words/${wordId}?includeExamples=1&exampleLimit=5`);
    expect(res.status).toBe(200);
    expect(res.body.data.exampleCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.examples)).toBe(true);
    expect(res.body.data.examples.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.examples[0]).toHaveProperty('sentence');
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

  it('更新词根校验失败时不会留下半更新状态', async () => {
    const getRes = await request(app).get(`/words/${wordId}`);
    const currentWord = getRes.body.data;

    const res = await request(app)
      .put(`/words/${wordId}`)
      .send({
        name: currentWord.name,
        meaning: '不会提交的含义',
        rootIds: [99999999],
      });

    expect(res.status).toBeGreaterThanOrEqual(400);

    const afterRes = await request(app).get(`/words/${wordId}`);
    expect(afterRes.body.data.meaning).toBe(currentWord.meaning);
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

  it('删除单词时会同步清理复习记录和复习历史', async () => {
    const res = await createWord();
    const wordId = res.body.data.id;

    await WordReview.update(
      {
        status: 'learning',
        interval: 2,
        dueDate: '2099-12-31',
        reviewCount: 1,
        successCount: 1,
      },
      { where: { userId, wordId } }
    );
    await ReviewHistory.create({
      userId,
      wordId,
      quality: 3,
      intervalBefore: 0,
      intervalAfter: 2,
      easeFactorBefore: 2.5,
      easeFactorAfter: 2.5,
      reviewedAt: new Date(),
    });

    const delRes = await request(app).delete(`/words/${wordId}`);
    expect(delRes.status).toBe(200);
    expect(await Word.findByPk(wordId)).toBeNull();
    expect(await WordReview.count({ where: { userId, wordId } })).toBe(0);
    expect(await ReviewHistory.count({ where: { userId, wordId } })).toBe(0);
  });

  it('删除其他用户的单词返回错误', async () => {
    // 创建另一个用户及其词根/单词
    const otherUser = await User.create({ username: `otherword_${suf()}`, password: 'x' });
    const otherRoot = await Root.create({
      name: `or_${suf()}`,
      meaning: 'x',
      userId: otherUser.id,
    });
    const otherWord = await Word.create({
      name: `ow_${suf()}`,
      meaning: 'x',
      userId: otherUser.id,
    });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const res = await request(app).delete(`/words/${otherWord.id}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
