/**
 * 测试：数据导出 & 数据导入 API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, sequelize, User, Root, Word, WordRoot, Example } from '../models/index.js';
import reviewDataRouter from '../routes/review/data.js';

// ============================================================
// 简易 app fixture
const buildApp = (userId) => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  // 模拟认证中间件：直接注入 userId
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/review', reviewDataRouter);
  return app;
};

let userId;
let app;

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: 'data_export_testuser_' + Date.now(), password: 'x' });
  userId = user.id;
  app = buildApp(userId);
});

afterAll(async () => {
  await sequelize.close();
});

// ======================== 导出 ========================

describe('GET /review/data/export', () => {
  let rootId;

  beforeAll(async () => {
    // 创建词根 + 单词 + 例句
    const root = await Root.create({ name: 'exportroot', meaning: '测试导出词根', userId });
    rootId = root.id;
    const word = await Word.create({ name: 'exportword', meaning: '导出单词', phonetic: '/test/' });
    await WordRoot.create({ wordId: word.id, rootId });
    await Example.create({
      wordId: word.id,
      sentence: 'Test sentence.',
      translation: '测试句子。',
    });
  });

  it('返回正确的 JSON 结构', async () => {
    const res = await request(app).get('/review/data/export');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0');
    expect(res.body.exportedAt).toBeTruthy();
    expect(Array.isArray(res.body.roots)).toBe(true);
    expect(Array.isArray(res.body.words)).toBe(true);
  });

  it('导出包含创建的词根', async () => {
    const res = await request(app).get('/review/data/export');
    const exportedRoot = res.body.roots.find((r) => r.name === 'exportroot');
    expect(exportedRoot).toBeDefined();
    expect(exportedRoot.meaning).toBe('测试导出词根');
  });

  it('导出包含单词及其词根关联和例句', async () => {
    const res = await request(app).get('/review/data/export');
    const word = res.body.words.find((w) => w.name === 'exportword');
    expect(word).toBeDefined();
    expect(word.rootNames).toContain('exportroot');
    expect(word.examples.length).toBeGreaterThan(0);
    expect(word.examples[0].sentence).toBe('Test sentence.');
  });
});

// ======================== 导入 ========================

describe('POST /review/data/import', () => {
  const sampleData = {
    version: '1.0',
    exportedAt: '2026-01-01T00:00:00Z',
    roots: [
      { name: 'importroot1', meaning: '导入词根1', remark: null, isDefault: false },
      { name: 'importroot2', meaning: '导入词根2', remark: null, isDefault: false },
    ],
    words: [
      {
        name: 'importword1',
        meaning: '导入单词1',
        phonetic: '/w1/',
        remark: null,
        rootNames: ['importroot1'],
        examples: [{ sentence: 'Import word one.', translation: '导入单词一。', remark: null }],
      },
      {
        name: 'importword2',
        meaning: '导入单词2',
        phonetic: '/w2/',
        remark: null,
        rootNames: ['importroot1', 'importroot2'],
        examples: [],
      },
    ],
  };

  it('成功导入新词根和单词', async () => {
    const res = await request(app).post('/review/data/import').send(sampleData);
    expect(res.status).toBe(200);
    expect(res.body.data.rootsAdded).toBe(2);
    expect(res.body.data.wordsAdded).toBe(2);
    expect(res.body.data.examplesAdded).toBe(1);
  });

  it('重复导入时不新增任何数据', async () => {
    const res = await request(app).post('/review/data/import').send(sampleData);
    expect(res.status).toBe(200);
    expect(res.body.data.rootsAdded).toBe(0);
    expect(res.body.data.wordsAdded).toBe(0);
    expect(res.body.data.examplesAdded).toBe(0);
  });

  it('导入后词根确实存在于数据库', async () => {
    const root = await Root.findOne({ where: { name: 'importroot1', userId } });
    expect(root).toBeTruthy();
    expect(root.meaning).toBe('导入词根1');
  });

  it('导入后词根-单词关联正确', async () => {
    const root = await Root.findOne({ where: { name: 'importroot1', userId } });
    const word = await Word.findOne({ where: { name: 'importword1' } });
    const link = await WordRoot.findOne({ where: { wordId: word.id, rootId: root.id } });
    expect(link).toBeTruthy();
  });

  it('多词根单词的所有关联均创建正确', async () => {
    const root1 = await Root.findOne({ where: { name: 'importroot1', userId } });
    const root2 = await Root.findOne({ where: { name: 'importroot2', userId } });
    const word = await Word.findOne({ where: { name: 'importword2' } });
    const link1 = await WordRoot.findOne({ where: { wordId: word.id, rootId: root1.id } });
    const link2 = await WordRoot.findOne({ where: { wordId: word.id, rootId: root2.id } });
    expect(link1).toBeTruthy();
    expect(link2).toBeTruthy();
  });

  it('例句正确创建且不重复', async () => {
    const word = await Word.findOne({ where: { name: 'importword1' } });
    const examples = await Example.findAll({
      where: { wordId: word.id, sentence: 'Import word one.' },
    });
    expect(examples.length).toBe(1);
  });

  it('格式无效时返回 400', async () => {
    const res = await request(app).post('/review/data/import').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });

  it('版本不匹配时返回 400', async () => {
    const res = await request(app)
      .post('/review/data/import')
      .send({ version: '2.0', roots: [], words: [] });
    expect(res.status).toBe(400);
  });
});
