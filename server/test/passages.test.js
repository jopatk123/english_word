/**
 * 测试：短文路由
 *   - 增删改查、参数校验、跨用户隔离
 *   - 分句与译文对齐、编辑时沿用译文
 *   - 修改单句译文
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, PassageSentence, PassageReview } from '../models/index.js';
import passagesRouter from '../routes/passages.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/passages', passagesRouter);
  return app;
};

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);

let app;
let otherApp;

const createPassage = (body = {}) =>
  request(app)
    .post('/passages')
    .send({ title: `T ${suf()}`, content: 'Tom has a cat. The cat is black.', ...body });

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `pa_${suf()}`, password: 'x' });
  const other = await User.create({ username: `pb_${suf()}`, password: 'x' });
  app = buildApp(user.id);
  otherApp = buildApp(other.id);
});

describe('POST /passages', () => {
  it('分句、统计词数并逐句对齐译文', async () => {
    const res = await createPassage({
      content: 'Tom has a cat.\n\nThe cat is black. It sleeps.',
      translation: '汤姆有一只猫。这只猫是黑色的。它在睡觉。',
      level: 'A1',
    });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.translationAligned).toBe(true);
    expect(data.wordCount).toBe(10);
    expect(data.sentenceCount).toBe(3);
    expect(data.content).toBe('Tom has a cat.\n\nThe cat is black. It sleeps.');
    expect(data.status).toBe('unread');
    expect(data.sentences.map((s) => [s.paragraphIndex, s.text, s.translation])).toEqual([
      [0, 'Tom has a cat.', '汤姆有一只猫。'],
      [1, 'The cat is black.', '这只猫是黑色的。'],
      [1, 'It sleeps.', '它在睡觉。'],
    ]);
  });

  it('译文句数不一致时整段放进第一句', async () => {
    const res = await createPassage({ translation: '汤姆有一只黑猫。' });
    expect(res.status).toBe(200);
    expect(res.body.data.translationAligned).toBe(false);
    expect(res.body.msg).toMatch(/第一句/);
    expect(res.body.data.sentences.map((s) => s.translation)).toEqual(['汤姆有一只黑猫。', null]);
  });

  it('AI 逐句译文按原句文本匹配', async () => {
    const res = await createPassage({
      source: 'ai',
      topic: 'pets',
      sentenceTranslations: [
        { text: 'The cat is black.', translation: '猫是黑的。' },
        { text: 'Removed line.', translation: '已删' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.topic).toBe('pets');
    expect(res.body.data.sentences.map((s) => s.translation)).toEqual([null, '猫是黑的。']);
  });

  it.each([
    [{ title: '' }, /标题/],
    [{ title: 'x'.repeat(121) }, /标题/],
    [{ content: '   ' }, /正文/],
    [{ content: 'a'.repeat(8001) }, /正文/],
    [{ content: '!!! ...' }, /句子/],
    [{ level: 'Z9' }, /难度/],
    [{ source: 'web' }, /来源/],
    [{ translation: 123 }, /译文/],
    [{ sentenceTranslations: 'x' }, /逐句译文/],
  ])('参数不合法返回 400：%o', async (body, msg) => {
    const res = await createPassage(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(msg);
  });

  it('超过 200 句返回 400', async () => {
    const res = await createPassage({ content: 'Go. '.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/200/);
  });
});

describe('GET /passages', () => {
  it('分页、关键词、难度和状态筛选', async () => {
    const tag = `kw${suf()}`;
    const a = await createPassage({ title: `${tag} one`, level: 'B1' });
    await createPassage({ title: `${tag} two`, level: 'B2' });

    const byKeyword = await request(app).get('/passages').query({ keyword: tag });
    expect(byKeyword.body.total).toBe(2);
    expect(byKeyword.body.data[0]).toMatchObject({ title: `${tag} two`, status: 'unread' });
    expect(byKeyword.body.data[0].excerpt).toBe('Tom has a cat. The cat is black.');

    const longContent = `Alpha ${'beta '.repeat(80)}omega end.`;
    await createPassage({ title: `${tag} long`, content: longContent });
    const excerpt = (
      await request(app)
        .get('/passages')
        .query({ keyword: `${tag} long` })
    ).body.data[0].excerpt;
    const body = excerpt.slice(0, -1);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(longContent.startsWith(body)).toBe(true);
    expect(longContent[body.length]).toBe(' ');
    expect(byKeyword.body.data[0]).not.toHaveProperty('content');

    const byLevel = await request(app).get('/passages').query({ keyword: tag, level: 'B1' });
    expect(byLevel.body.data.map((p) => p.id)).toEqual([a.body.data.id]);

    await request(app).post(`/passages/${a.body.data.id}/read`).send({ rating: 'good' });
    const learning = await request(app)
      .get('/passages')
      .query({ keyword: tag, status: 'learning' });
    expect(learning.body.data.map((p) => p.id)).toEqual([a.body.data.id]);
    const unread = await request(app).get('/passages').query({ keyword: tag, status: 'unread' });
    expect(unread.body.data.map((p) => p.title)).toEqual([`${tag} long`, `${tag} two`]);

    const paged = await request(app).get('/passages').query({ keyword: tag, page: 2, pageSize: 1 });
    expect(paged.body.total).toBe(3);
    expect(paged.body.data).toHaveLength(1);
  });

  it('待重读筛选和计数', async () => {
    const created = await createPassage();
    const id = created.body.data.id;
    await request(app).post(`/passages/${id}/read`).send({ rating: 'good' });
    await PassageReview.update({ dueDate: '2000-01-01' }, { where: { passageId: id } });

    const due = await request(app).get('/passages').query({ status: 'due' });
    expect(due.body.data.some((p) => p.id === id && p.status === 'due')).toBe(true);
    const count = await request(app).get('/passages/due/count');
    expect(count.body.data.count).toBeGreaterThanOrEqual(1);
    const otherCount = await request(otherApp).get('/passages/due/count');
    expect(otherCount.body.data.count).toBe(0);
  });
});

describe('PUT /passages/:id', () => {
  it('正文不变时只更新标题和难度，译文保留', async () => {
    const created = await createPassage({ translation: '汤姆有一只猫。猫是黑的。' });
    const id = created.body.data.id;
    const firstSentenceId = created.body.data.sentences[0].id;

    const res = await request(app)
      .put(`/passages/${id}`)
      .send({ title: '新标题', content: 'Tom has a cat. The cat is black.', level: 'A2' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: '新标题', level: 'A2' });
    expect(res.body.data.sentences[0].id).toBe(firstSentenceId);
    expect(res.body.data.sentences[1].translation).toBe('猫是黑的。');
  });

  it('改正文后重新分句，未变化的句子沿用译文', async () => {
    const created = await createPassage({ translation: '汤姆有一只猫。猫是黑的。' });
    const id = created.body.data.id;

    const res = await request(app)
      .put(`/passages/${id}`)
      .send({ title: 'x', content: 'Tom has a dog. The cat is black. It is old.' });
    expect(res.body.data.sentenceCount).toBe(3);
    expect(res.body.data.sentences.map((s) => s.translation)).toEqual([null, '猫是黑的。', null]);
  });

  it('提供整篇译文时覆盖原有译文', async () => {
    const created = await createPassage({ translation: '旧一。旧二。' });
    const res = await request(app)
      .put(`/passages/${created.body.data.id}`)
      .send({ title: 'x', content: created.body.data.content, translation: '新一。新二。' });
    expect(res.body.data.sentences.map((s) => s.translation)).toEqual(['新一。', '新二。']);
  });

  it('不允许修改来源', async () => {
    const created = await createPassage();
    const res = await request(app)
      .put(`/passages/${created.body.data.id}`)
      .send({ title: 'x', content: created.body.data.content, source: 'ai' });
    expect(res.body.data.source).toBe('manual');
  });
});

describe('PUT /passages/:id/sentences/:sentenceId', () => {
  it('保存和清空单句译文', async () => {
    const created = await createPassage();
    const { id, sentences } = created.body.data;
    const url = `/passages/${id}/sentences/${sentences[1].id}`;

    const saved = await request(app).put(url).send({ translation: ' 猫是黑的。 ' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.translation).toBe('猫是黑的。');

    const cleared = await request(app).put(url).send({ translation: '' });
    expect(cleared.body.data.translation).toBeNull();

    const tooLong = await request(app)
      .put(url)
      .send({ translation: 'x'.repeat(1001) });
    expect(tooLong.status).toBe(400);
  });

  it('句子不属于这篇短文时返回 404', async () => {
    const a = await createPassage();
    const b = await createPassage();
    const res = await request(app)
      .put(`/passages/${a.body.data.id}/sentences/${b.body.data.sentences[0].id}`)
      .send({ translation: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('跨用户隔离与删除', () => {
  it('其他用户无法查看、修改、删除', async () => {
    const created = await createPassage();
    const id = created.body.data.id;

    expect((await request(otherApp).get(`/passages/${id}`)).status).toBe(404);
    expect(
      (await request(otherApp).put(`/passages/${id}`).send({ title: 'x', content: 'Hi.' })).status
    ).toBe(404);
    expect((await request(otherApp).delete(`/passages/${id}`)).status).toBe(404);
    expect(
      (await request(otherApp).post(`/passages/${id}/read`).send({ rating: 'good' })).status
    ).toBe(404);
    const list = await request(otherApp).get('/passages');
    expect(list.body.data.some((p) => p.id === id)).toBe(false);
  });

  it('删除时一并删除句子和复习记录', async () => {
    const created = await createPassage();
    const id = created.body.data.id;
    await request(app).post(`/passages/${id}/read`).send({ rating: 'easy' });

    const res = await request(app).delete(`/passages/${id}`);
    expect(res.status).toBe(200);
    expect((await request(app).get(`/passages/${id}`)).status).toBe(404);
    expect(await PassageSentence.count({ where: { passageId: id } })).toBe(0);
    expect(await PassageReview.count({ where: { passageId: id } })).toBe(0);
  });
});
