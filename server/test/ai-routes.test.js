/**
 * 测试：server/routes/ai.js 路由
 *   - POST /ai/test
 *   - POST /ai/suggest-roots
 *   - POST /ai/suggest-words
 *   - POST /ai/suggest-examples
 *   - POST /ai/analyze-word
 *   - POST /ai/analyze-sentence
 *
 * 使用 vi.mock 将 requestAiJson 替换为模拟函数，
 * 真实的 validateAiConfig / sanitize 函数保持不变。
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root, Word, WordRoot } from '../models/index.js';
import aiRouter from '../routes/ai.js';

// ── mock requestAiJson（保留其他真实实现）────────────────────
vi.mock('../utils/ai.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestAiJson: vi.fn(),
  };
});

// 需要在 mock 之后 import，才能拿到 mock 版本
const { requestAiJson } = await import('../utils/ai.js');

// ── 有效的 AI 配置 ─────────────────────────────────────────────
const validConfig = {
  apiKey: 'sk-test12345678',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  providerId: 'openai',
  providerType: 'openai-compatible',
  temperature: 0.2,
};

// ── Test App fixture ──────────────────────────────────────────
const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/ai', aiRouter);
  return app;
};

let app;
let userId;
let rootId;
let wordId;

const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `aitest_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);

  const root = await Root.create({ name: `airoot_${suf()}`, meaning: '测试词根', userId });
  rootId = root.id;

  const word = await Word.create({ name: `inspect_${suf()}`, meaning: '检查', userId });
  await WordRoot.create({ wordId: word.id, rootId: root.id });
  wordId = word.id;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ================================================================
// POST /ai/test
// ================================================================

describe('POST /ai/test', () => {
  it('配置合法且 AI 返回 ok 时成功', async () => {
    requestAiJson.mockResolvedValue({ message: 'ok', items: [] });

    const res = await request(app).post('/ai/test').send({ config: validConfig });
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('AI 返回 items 数组时 ok=true', async () => {
    requestAiJson.mockResolvedValue({ message: 'anything', items: ['x'] });

    const res = await request(app).post('/ai/test').send({ config: validConfig });
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app)
      .post('/ai/test')
      .send({ config: { apiKey: '' } });
    expect(res.status).toBe(400);
  });

  it('requestAiJson 抛出错误时返回 400', async () => {
    requestAiJson.mockRejectedValue(new Error('AI 调用失败'));
    const res = await request(app).post('/ai/test').send({ config: validConfig });
    expect(res.status).toBe(400);
  });
});

// ================================================================
// POST /ai/suggest-roots
// ================================================================

describe('POST /ai/suggest-roots', () => {
  it('成功推荐并过滤词根', async () => {
    requestAiJson.mockResolvedValue({
      hasMore: true,
      items: [
        { name: 'aud', meaning: '听' },
        { name: 'duc', meaning: '引导' },
      ],
    });

    const res = await request(app).post('/ai/suggest-roots').send({ config: validConfig });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data).toHaveProperty('hasMore');
    expect(res.body.data).toHaveProperty('message');
  });

  it('AI 返回已有词根时被过滤（空结果）', async () => {
    // 返回已存在于 DB 的词根名
    const rootData = await Root.findByPk(rootId);
    requestAiJson.mockResolvedValue({
      hasMore: false,
      items: [{ name: rootData.name, meaning: '测试' }],
    });

    const res = await request(app).post('/ai/suggest-roots').send({ config: validConfig });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.message).toContain('没有明显');
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app).post('/ai/suggest-roots').send({ config: {} });
    expect(res.status).toBe(400);
  });

  it('requestAiJson 抛出错误时返回 400', async () => {
    requestAiJson.mockRejectedValue(new Error('AI 失败'));
    const res = await request(app).post('/ai/suggest-roots').send({ config: validConfig });
    expect(res.status).toBe(400);
  });
});

// ================================================================
// POST /ai/suggest-words
// ================================================================

describe('POST /ai/suggest-words', () => {
  it('成功推荐单词', async () => {
    requestAiJson.mockResolvedValue({
      hasMore: true,
      items: [
        {
          name: 'transport',
          meaning: '运输',
          phonetic: '/trænsˈpɔːrt/',
          partOfSpeech: [{ type: 'v.', meaning: '运输' }],
        },
      ],
    });

    const res = await request(app).post('/ai/suggest-words').send({ config: validConfig, rootId });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.root).toHaveProperty('id', rootId);
  });

  it('缺少 rootId 返回 400', async () => {
    const res = await request(app).post('/ai/suggest-words').send({ config: validConfig });
    expect(res.status).toBe(400);
  });

  it('词根不存在时返回 404', async () => {
    requestAiJson.mockResolvedValue({ hasMore: false, items: [] });
    const res = await request(app)
      .post('/ai/suggest-words')
      .send({ config: validConfig, rootId: 9999999 });
    expect(res.status).toBe(404);
  });

  it('他人词根返回 404', async () => {
    const otherUser = await User.create({ username: `other_${suf()}`, password: 'y' });
    const otherRoot = await Root.create({
      name: `otherroot_${suf()}`,
      meaning: '他人',
      userId: otherUser.id,
    });
    const res = await request(app)
      .post('/ai/suggest-words')
      .send({ config: validConfig, rootId: otherRoot.id });
    expect(res.status).toBe(404);
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app).post('/ai/suggest-words').send({ config: {}, rootId });
    expect(res.status).toBe(400);
  });

  it('带 excludedWords 时正常工作', async () => {
    requestAiJson.mockResolvedValue({ hasMore: false, items: [] });
    const res = await request(app)
      .post('/ai/suggest-words')
      .send({ config: validConfig, rootId, excludedWords: ['inspect'] });
    expect(res.status).toBe(200);
  });
});

// ================================================================
// POST /ai/suggest-examples
// ================================================================

describe('POST /ai/suggest-examples', () => {
  it('成功推荐例句', async () => {
    requestAiJson.mockResolvedValue({
      hasMore: true,
      items: [{ sentence: 'She inspects the room carefully.', translation: '她仔细检查了房间。' }],
    });

    const res = await request(app)
      .post('/ai/suggest-examples')
      .send({ config: validConfig, wordId });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.word).toHaveProperty('id', wordId);
  });

  it('缺少 wordId 返回 400', async () => {
    const res = await request(app).post('/ai/suggest-examples').send({ config: validConfig });
    expect(res.status).toBe(400);
  });

  it('单词不存在时返回 404', async () => {
    const res = await request(app)
      .post('/ai/suggest-examples')
      .send({ config: validConfig, wordId: 9999999 });
    expect(res.status).toBe(404);
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app).post('/ai/suggest-examples').send({ config: {}, wordId });
    expect(res.status).toBe(400);
  });

  it('带 excludedSentences 时正常工作', async () => {
    requestAiJson.mockResolvedValue({ hasMore: false, items: [] });
    const res = await request(app)
      .post('/ai/suggest-examples')
      .send({ config: validConfig, wordId, excludedSentences: ['Old sentence.'] });
    expect(res.status).toBe(200);
  });
});

// ================================================================
// POST /ai/analyze-word
// ================================================================

describe('POST /ai/analyze-word', () => {
  it('单词不在库中时调用 AI 分析', async () => {
    requestAiJson.mockResolvedValue({
      word: 'brilliant',
      meaning: '才华横溢的',
      phonetic: '/ˈbrɪliənt/',
      partOfSpeech: [{ type: 'adj.', meaning: '才华横溢的' }],
      roots: [],
      examples: [{ sentence: 'She is brilliant.', translation: '她很聪明。' }],
    });

    const res = await request(app)
      .post('/ai/analyze-word')
      .send({ config: validConfig, word: 'brilliant' });
    expect(res.status).toBe(200);
    expect(res.body.data.analysis.word).toBe('brilliant');
    expect(res.body.data.existingWord).toBeNull();
  });

  it('单词非法时返回 400', async () => {
    const res = await request(app)
      .post('/ai/analyze-word')
      .send({ config: validConfig, word: '123abc!' });
    expect(res.status).toBe(400);
  });

  it('单词为空时返回 400', async () => {
    const res = await request(app).post('/ai/analyze-word').send({ config: validConfig });
    expect(res.status).toBe(400);
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app).post('/ai/analyze-word').send({ config: {}, word: 'transport' });
    expect(res.status).toBe(400);
  });

  it('AI 返回无效数据时返回 400', async () => {
    requestAiJson.mockResolvedValue(null);
    const res = await request(app)
      .post('/ai/analyze-word')
      .send({ config: validConfig, word: 'unique' });
    expect(res.status).toBe(400);
  });

  it('singleExample=true 时例句数量不超过 1', async () => {
    requestAiJson.mockResolvedValue({
      word: 'transport',
      meaning: '运输',
      phonetic: '',
      partOfSpeech: [{ type: 'v.', meaning: '运输' }],
      roots: [],
      examples: [
        { sentence: 'We transport goods by ship.', translation: '我们用船运输货物。' },
        { sentence: 'They use trucks to transport.', translation: '他们用卡车运输。' },
      ],
    });

    const res = await request(app)
      .post('/ai/analyze-word')
      .send({ config: validConfig, word: 'transport', singleExample: true });
    expect(res.status).toBe(200);
    expect(res.body.data.analysis.examples.length).toBeLessThanOrEqual(1);
  });
});

// ================================================================
// POST /ai/analyze-sentence
// ================================================================

describe('POST /ai/analyze-sentence', () => {
  it('成功分析句子', async () => {
    requestAiJson.mockResolvedValue({
      sentence: 'She reads every day.',
      vocabulary: [{ word: 'read', meaning: '阅读', phonetic: '/riːd/', partOfSpeech: 'v.' }],
      translation: '她每天阅读。',
      grammar: '主谓结构',
    });

    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: 'She reads every day.' });
    expect(res.status).toBe(200);
    expect(res.body.data.analysis).toHaveProperty('vocabulary');
  });

  it('句子为空时返回 400', async () => {
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: '' });
    expect(res.status).toBe(400);
  });

  it('句子只有 1 个字符时返回 400', async () => {
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: 'A' });
    expect(res.status).toBe(400);
  });

  it('sentence 为非字符串时返回 400', async () => {
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: 123 });
    expect(res.status).toBe(400);
  });

  it('配置不完整时返回 400', async () => {
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: {}, sentence: 'She reads every day.' });
    expect(res.status).toBe(400);
  });

  it('AI 返回无效结果时返回 400', async () => {
    requestAiJson.mockResolvedValue(null);
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: 'She reads every day.' });
    expect(res.status).toBe(400);
  });

  it('requestAiJson 抛出错误时返回 400', async () => {
    requestAiJson.mockRejectedValue(new Error('AI 超时'));
    const res = await request(app)
      .post('/ai/analyze-sentence')
      .send({ config: validConfig, sentence: 'She reads every day.' });
    expect(res.status).toBe(400);
  });
});
