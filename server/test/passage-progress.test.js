/**
 * 测试：短文读完自评、从短文加入生词
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Word, Example, WordReview, Root } from '../models/index.js';
import passagesRouter from '../routes/passages.js';
import { todayStr, addDays } from '../utils/srs.js';

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
let userId;
let otherApp;

const createPassage = async (body = {}) => {
  const res = await request(app)
    .post('/passages')
    .send({
      title: `Story ${suf()}`,
      content: 'The fox jumps. The dog sleeps.',
      translation: '狐狸跳。狗睡觉。',
      ...body,
    });
  return res.body.data;
};

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `pp_${suf()}`, password: 'x' });
  const other = await User.create({ username: `pq_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  otherApp = buildApp(other.id);
});

describe('POST /passages/:id/read', () => {
  it('首次读完创建进度，再次读完按档位推进', async () => {
    const passage = await createPassage();
    const today = todayStr();

    const first = await request(app).post(`/passages/${passage.id}/read`).send({ rating: 'good' });
    expect(first.status).toBe(200);
    expect(first.body.data.review).toMatchObject({
      stage: 1,
      readCount: 1,
      lastRating: 'good',
      dueDate: addDays(today, 3),
    });
    expect(first.body.data.status).toBe('learning');

    const second = await request(app).post(`/passages/${passage.id}/read`).send({ rating: 'easy' });
    expect(second.body.data.review).toMatchObject({
      stage: 3,
      readCount: 2,
      dueDate: addDays(today, 15),
    });

    const detail = await request(app).get(`/passages/${passage.id}`);
    expect(detail.body.data.review.readCount).toBe(2);
  });

  it('自评不合法返回 400', async () => {
    const passage = await createPassage();
    const res = await request(app).post(`/passages/${passage.id}/read`).send({ rating: 'great' });
    expect(res.status).toBe(400);
  });
});

describe('POST /passages/:id/words', () => {
  it('新词加入「未分类」并把所在句写成例句', async () => {
    const passage = await createPassage();
    const name = `vixen${suf().replace(/[^a-z]/g, '')}`;
    const res = await request(app)
      .post(`/passages/${passage.id}/words`)
      .send({ name, meaning: '雌狐', phonetic: '/x/', sentenceId: passage.sentences[0].id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ wordCreated: true, exampleAdded: true });
    const word = await Word.findByPk(res.body.data.word.id, {
      include: [{ model: Root, as: 'roots' }],
    });
    expect(word.userId).toBe(userId);
    expect(word.roots.map((r) => r.isDefault)).toEqual([true]);
    expect(await WordReview.count({ where: { wordId: word.id, userId } })).toBe(1);

    const examples = await Example.findAll({ where: { wordId: word.id } });
    expect(examples).toHaveLength(1);
    expect(examples[0]).toMatchObject({
      sentence: 'The fox jumps.',
      translation: '狐狸跳。',
      remark: `来自短文《${passage.title}》`,
    });
  });

  it('已有单词只补例句，同一句不重复写', async () => {
    const passage = await createPassage();
    const name = `hound${suf().replace(/[^a-z]/g, '')}`;
    const send = (sentenceId) =>
      request(app)
        .post(`/passages/${passage.id}/words`)
        .send({ name, meaning: '猎犬', sentenceId });

    await send(passage.sentences[0].id);
    const second = await send(passage.sentences[1].id);
    expect(second.body.data).toMatchObject({ wordCreated: false, exampleAdded: true });
    expect(second.body.msg).toMatch(/例句/);

    const third = await send(passage.sentences[1].id);
    expect(third.body.data).toMatchObject({ wordCreated: false, exampleAdded: false });
    expect(await Example.count({ where: { wordId: second.body.data.word.id } })).toBe(2);
  });

  it('没有译文的句子写入空译文', async () => {
    const passage = await createPassage({ translation: undefined });
    const name = `owl${suf().replace(/[^a-z]/g, '')}`;
    const res = await request(app)
      .post(`/passages/${passage.id}/words`)
      .send({ name, meaning: '猫头鹰', sentenceId: passage.sentences[0].id });
    const example = await Example.findOne({ where: { wordId: res.body.data.word.id } });
    expect(example.translation).toBe('');
  });

  it.each([
    [{ name: '123', meaning: 'x' }, 400],
    [{ name: `nomeaning${suf().replace(/[^a-z]/g, '')}` }, 400],
    [{ name: 'fox', meaning: 'x', sentenceId: 0 }, 400],
    [{ name: 'fox', meaning: 'x', sentenceId: 99999999 }, 404],
  ])('参数不合法：%o', async (body, status) => {
    const passage = await createPassage();
    const res = await request(app)
      .post(`/passages/${passage.id}/words`)
      .send({ sentenceId: passage.sentences[0].id, ...body });
    expect(res.status).toBe(status);
  });

  it('其他用户的短文不能加词', async () => {
    const passage = await createPassage();
    const res = await request(otherApp)
      .post(`/passages/${passage.id}/words`)
      .send({ name: 'fox', meaning: '狐狸', sentenceId: passage.sentences[0].id });
    expect(res.status).toBe(404);
  });
});
