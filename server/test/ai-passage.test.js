/**
 * 测试：短文 AI 接口
 *   - POST /ai/generate-passage
 *   - POST /ai/translate-passage
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Word, WordReview, PassageSentence } from '../models/index.js';
import { baseAiConfig } from './ai-test-utils.js';

vi.mock('../utils/ai.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, requestAiJson: vi.fn() };
});

const { requestAiJson, AiTimeoutError } = await import('../utils/ai.js');
const { default: aiRouter } = await import('../routes/ai.js');
const { default: passagesRouter } = await import('../routes/passages.js');

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/ai', aiRouter);
  app.use('/passages', passagesRouter);
  return app;
};

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);

let app;
let otherApp;
let userId;

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `aip_${suf()}`, password: 'x' });
  const other = await User.create({ username: `aiq_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  otherApp = buildApp(other.id);
});

afterEach(() => {
  requestAiJson.mockReset();
});

const generate = (body = {}) =>
  request(app)
    .post('/ai/generate-passage')
    .send({ config: baseAiConfig, topic: 'rain', level: 'A2', length: 'short', ...body });

describe('POST /ai/generate-passage', () => {
  it('返回与保存时一致的分句预览，不写入数据库', async () => {
    requestAiJson.mockResolvedValue({
      title: 'A Rainy Day',
      paragraphs: [
        [
          { en: 'It rains.  Mr. Lee stays home.', zh: '下雨了。李先生待在家。' },
          { en: 'He reads.', zh: '他看书。' },
        ],
        [
          { en: '', zh: '空句' },
          { en: '12345', zh: '数字' },
        ],
        [{ en: 'The end.', zh: '结束。' }],
      ],
    });

    const res = await generate();
    expect(res.status).toBe(200);
    const passage = res.body.data.passage;
    expect(passage).toMatchObject({
      title: 'A Rainy Day',
      level: 'A2',
      topic: 'rain',
      content: 'It rains. Mr. Lee stays home. He reads.\n\nThe end.',
      targetWords: [],
      usedWords: [],
    });
    expect(passage.sentences.map((s) => [s.paragraphIndex, s.text, s.translation])).toEqual([
      [0, 'It rains.', '下雨了。李先生待在家。'],
      [0, 'Mr. Lee stays home.', null],
      [0, 'He reads.', '他看书。'],
      [1, 'The end.', '结束。'],
    ]);

    const prompt = requestAiJson.mock.calls[0][1].userPrompt;
    expect(prompt).toContain('rain');
    expect(prompt).toContain('CEFR A2');
    expect(prompt).toContain('约 120 个英文单词');

    const list = await request(app).get('/passages');
    expect(list.body.total).toBe(0);
  });

  it('预览可以直接保存，逐句译文完整保留', async () => {
    requestAiJson.mockResolvedValue({
      title: 'Cats',
      paragraphs: [
        [
          { en: 'Cats sleep a lot.', zh: '猫睡得很多。' },
          { en: 'They like sun.', zh: '它们喜欢阳光。' },
        ],
      ],
    });
    const { passage } = (await generate()).body.data;

    const saved = await request(app).post('/passages').send({
      title: passage.title,
      content: passage.content,
      level: passage.level,
      source: 'ai',
      topic: passage.topic,
      sentenceTranslations: passage.sentences,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.sentences.map((s) => s.translation)).toEqual([
      '猫睡得很多。',
      '它们喜欢阳光。',
    ]);
  });

  it('勾选目标单词时优先挑已掌握的词，不足再用未掌握的词补齐', async () => {
    const make = async (name, status, paused = false) => {
      const word = await Word.create({ name, meaning: 'x', userId });
      await WordReview.create({ userId, wordId: word.id, status, dueDate: '2099-01-01', paused });
    };
    await make('harvest', 'learning');
    await make('lantern', 'review');
    await make('glacier', 'known');
    await make('meadow', 'learning', true);

    requestAiJson.mockResolvedValue({
      title: 'Autumn',
      paragraphs: [[{ en: 'Farmers harvested corn at night.', zh: '农民在夜里收割玉米。' }]],
    });
    const res = await generate({ useLearningWords: true });
    const { targetWords, usedWords } = res.body.data.passage;
    // 已掌握的 glacier 优先，剩余名额从未掌握、未暂停的 harvest/lantern 里补齐
    expect([...targetWords].sort()).toEqual(['glacier', 'harvest', 'lantern']);
    expect(usedWords).toEqual(['harvest']);
    expect(requestAiJson.mock.calls[0][1].userPrompt).toContain('glacier');
    expect(requestAiJson.mock.calls[0][1].userPrompt).toContain('harvest');
  });

  it('已掌握单词足够时只挑已掌握的词', async () => {
    const fresh = await User.create({ username: `air_${suf()}`, password: 'x' });
    const freshApp = buildApp(fresh.id);
    const addWord = async (name, status) => {
      const word = await Word.create({ name, meaning: 'x', userId: fresh.id });
      await WordReview.create({ userId: fresh.id, wordId: word.id, status, dueDate: '2099-01-01' });
    };
    for (let i = 0; i < 10; i += 1) await addWord(`known${i}`, 'known');
    await addWord('learningx', 'learning');

    requestAiJson.mockResolvedValue({
      title: 'T',
      paragraphs: [[{ en: 'Hello world.', zh: '你好世界。' }]],
    });
    const res = await request(freshApp).post('/ai/generate-passage').send({
      config: baseAiConfig,
      topic: 't',
      level: 'A2',
      length: 'short',
      useLearningWords: true,
    });
    const { targetWords } = res.body.data.passage;
    expect(targetWords).toHaveLength(8);
    expect(targetWords.every((word) => word.startsWith('known'))).toBe(true);
  });

  it('已掌握为空时退回未掌握的单词，两者都没有则不限定词汇', async () => {
    const fresh = await User.create({ username: `ais_${suf()}`, password: 'x' });
    const freshApp = buildApp(fresh.id);
    requestAiJson.mockResolvedValue({
      title: 'T',
      paragraphs: [[{ en: 'Hello world.', zh: '你好世界。' }]],
    });
    const ask = () =>
      request(freshApp).post('/ai/generate-passage').send({
        config: baseAiConfig,
        topic: 't',
        level: 'A2',
        length: 'short',
        useLearningWords: true,
      });

    // 词库为空：目标词为空数组，Prompt 走「不需要指定词汇」分支
    const empty = await ask();
    expect(empty.body.data.passage.targetWords).toEqual([]);
    expect(requestAiJson.mock.calls.at(-1)[1].userPrompt).toContain('不需要指定词汇');

    // 只有未掌握的词：退回未掌握的词
    const word = await Word.create({ name: 'orbit', meaning: 'x', userId: fresh.id });
    await WordReview.create({
      userId: fresh.id,
      wordId: word.id,
      status: 'learning',
      dueDate: '2099-01-01',
    });
    const res = await ask();
    expect(res.body.data.passage.targetWords).toEqual(['orbit']);
  });

  it.each([
    [{ level: 'Z1' }, /难度/],
    [{ length: 'huge' }, /长度/],
    [{ topic: 'x'.repeat(61) }, /主题/],
    [{ topic: 42 }, /主题/],
  ])('参数不合法返回 400：%o', async (body, msg) => {
    const res = await generate(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(msg);
    expect(requestAiJson).not.toHaveBeenCalled();
  });

  it('AI 返回结构无效时返回 400', async () => {
    requestAiJson.mockResolvedValue({ title: 'x', paragraphs: [[{ en: '' }]] });
    const res = await generate();
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/无效/);
  });

  it('AI 超时返回 5xx', async () => {
    requestAiJson.mockRejectedValue(new AiTimeoutError('timeout'));
    const res = await generate();
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe('POST /ai/translate-passage', () => {
  const createPassage = async (appInstance = app) =>
    (
      await request(appInstance)
        .post('/passages')
        .send({ title: 'T', content: 'One fish. Two fish. Red fish.' })
    ).body.data;

  it('只翻译缺失的句子并写回数据库', async () => {
    const passage = await createPassage();
    await request(app)
      .put(`/passages/${passage.id}/sentences/${passage.sentences[1].id}`)
      .send({ translation: '两条鱼。' });

    requestAiJson.mockResolvedValue({
      items: [
        { i: 0, zh: '一条鱼。' },
        { i: 1, zh: '不应覆盖' },
        { i: 2, zh: '红色的鱼。' },
        { i: 0, zh: '重复项' },
      ],
    });
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: passage.id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ translatedCount: 2, missingCount: 0 });
    expect(res.body.data.sentences.map((s) => s.translation)).toEqual([
      '一条鱼。',
      '两条鱼。',
      '红色的鱼。',
    ]);
    const prompt = requestAiJson.mock.calls[0][1].userPrompt;
    expect(prompt).toContain('One fish.');
    expect(prompt).not.toContain('Two fish.');
  });

  it('部分句子缺译文时提示剩余数量', async () => {
    const passage = await createPassage();
    requestAiJson.mockResolvedValue({ items: [{ i: 0, zh: '一条鱼。' }] });
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: passage.id });
    expect(res.body.data).toMatchObject({ translatedCount: 1, missingCount: 2 });
    expect(res.body.msg).toMatch(/2 句未能翻译/);
  });

  it('全部已有译文时不调用 AI', async () => {
    const created = await request(app)
      .post('/passages')
      .send({ title: 'T', content: 'Hi. Bye.', translation: '嗨。再见。' });
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: created.body.data.id });
    expect(res.status).toBe(200);
    expect(res.body.data.translatedCount).toBe(0);
    expect(requestAiJson).not.toHaveBeenCalled();
  });

  it('超过 40 句时分批请求', async () => {
    const created = await request(app)
      .post('/passages')
      .send({ title: 'Long', content: 'Go now. '.repeat(45) });
    requestAiJson.mockImplementation(async (_config, prompts) => {
      const items = JSON.parse(prompts.userPrompt.slice(prompts.userPrompt.lastIndexOf('[')));
      return { items: items.map((item) => ({ i: item.i, zh: '现在走。' })) };
    });
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: created.body.data.id });
    expect(requestAiJson).toHaveBeenCalledTimes(2);
    expect(res.body.data.translatedCount).toBe(45);
  });

  it('AI 一句都没翻出来时返回 400 且不改数据', async () => {
    const passage = await createPassage();
    requestAiJson.mockResolvedValue({ items: [{ i: 99, zh: 'x' }] });
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: passage.id });
    expect(res.status).toBe(400);
    const rows = await PassageSentence.findAll({ where: { passageId: passage.id } });
    expect(rows.every((row) => row.translation === null)).toBe(true);
  });

  it('不能翻译其他用户的短文', async () => {
    const passage = await createPassage(otherApp);
    const res = await request(app)
      .post('/ai/translate-passage')
      .send({ config: baseAiConfig, passageId: passage.id });
    expect(res.status).toBe(404);
    expect(requestAiJson).not.toHaveBeenCalled();
  });

  it('缺少短文 ID 返回 400', async () => {
    const res = await request(app).post('/ai/translate-passage').send({ config: baseAiConfig });
    expect(res.status).toBe(400);
  });
});
