/**
 * 测试：数据导出 & 数据导入 API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  initDB,
  sequelize,
  User,
  Root,
  Word,
  WordRoot,
  Example,
  WordReview,
} from '../models/index.js';
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
    const word = await Word.create({
      name: 'exportword',
      meaning: '导出单词',
      phonetic: '/test/',
      userId,
    });
    await WordRoot.create({ wordId: word.id, rootId });
    await Example.create({
      wordId: word.id,
      sentence: 'Test sentence.',
      translation: '测试句子。',
    });
    await WordReview.create({
      userId,
      wordId: word.id,
      status: 'learning',
      interval: 2,
      easeFactor: 2.5,
      dueDate: '2099-01-01',
      reviewCount: 1,
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
    expect(word.interval).toBe(2);
    expect(word.rootNames).toContain('exportroot');
    expect(word.examples.length).toBeGreaterThan(0);
    expect(word.examples[0].sentence).toBe('Test sentence.');
  });

  it('导出包含完整复习进度字段', async () => {
    const res = await request(app).get('/review/data/export');
    const word = res.body.words.find((w) => w.name === 'exportword');
    expect(word).toBeDefined();
    expect(word.status).toBe('learning');
    expect(word.interval).toBe(2);
    expect(Number(word.easeFactor)).toBeCloseTo(2.5);
    expect(word.dueDate).toBe('2099-01-01');
    expect(word.reviewCount).toBe(1);
    expect(word.successCount).toBe(0);
    expect(word.perfectStreakCount).toBe(0);
  });

  it('导出不会带出其他用户的单词', async () => {
    const otherUser = await User.create({
      username: 'data_export_other_' + Date.now(),
      password: 'x',
    });
    const otherRoot = await Root.create({
      name: 'other-export-root',
      meaning: '他人词根',
      userId: otherUser.id,
    });
    const otherWord = await Word.create({
      name: 'other-export-word',
      meaning: '他人单词',
      userId: otherUser.id,
    });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const res = await request(app).get('/review/data/export');
    expect(res.status).toBe(200);
    expect(res.body.words.some((w) => w.name === 'other-export-word')).toBe(false);
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

  const uncategorizedSampleData = {
    version: '1.0',
    exportedAt: '2026-01-01T00:00:00Z',
    roots: [{ name: '未分类', meaning: '无明确词根来源的单词', remark: null, isDefault: true }],
    words: [
      {
        name: 'uncategorizedword',
        meaning: '无词根单词',
        phonetic: '/uŋ/',
        remark: null,
        rootNames: ['未分类'],
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
    const word = await Word.findOne({ where: { name: 'importword1', userId } });
    const link = await WordRoot.findOne({ where: { wordId: word.id, rootId: root.id } });
    expect(link).toBeTruthy();
  });

  it('导入后单词会自动补齐复习记录', async () => {
    const word = await Word.findOne({ where: { name: 'importword1', userId } });
    const review = await WordReview.findOne({ where: { userId, wordId: word.id } });
    expect(review).toBeTruthy();
    expect(review.status).toBe('new');
  });

  it('多词根单词的所有关联均创建正确', async () => {
    const root1 = await Root.findOne({ where: { name: 'importroot1', userId } });
    const root2 = await Root.findOne({ where: { name: 'importroot2', userId } });
    const word = await Word.findOne({ where: { name: 'importword2', userId } });
    const link1 = await WordRoot.findOne({ where: { wordId: word.id, rootId: root1.id } });
    const link2 = await WordRoot.findOne({ where: { wordId: word.id, rootId: root2.id } });
    expect(link1).toBeTruthy();
    expect(link2).toBeTruthy();
  });

  it('例句正确创建且不重复', async () => {
    const word = await Word.findOne({ where: { name: 'importword1', userId } });
    const examples = await Example.findAll({
      where: { wordId: word.id, sentence: 'Import word one.' },
    });
    expect(examples.length).toBe(1);
  });

  it('导入后的单词属于当前用户', async () => {
    const word = await Word.findOne({ where: { name: 'importword1', userId } });
    expect(word).toBeTruthy();
    expect(word.userId).toBe(userId);
  });

  it('不同用户导入同名单词时会创建各自独立的记录', async () => {
    const otherUser = await User.create({
      username: 'data_import_other_' + Date.now(),
      password: 'x',
    });
    const otherApp = buildApp(otherUser.id);

    const res = await request(otherApp).post('/review/data/import').send(sampleData);
    expect(res.status).toBe(200);
    expect(res.body.data.wordsAdded).toBe(2);

    const [currentUserWord, otherUserWord] = await Promise.all([
      Word.findOne({ where: { name: 'importword1', userId } }),
      Word.findOne({ where: { name: 'importword1', userId: otherUser.id } }),
    ]);

    expect(currentUserWord).toBeTruthy();
    expect(otherUserWord).toBeTruthy();
    expect(currentUserWord.id).not.toBe(otherUserWord.id);

    const [currentReview, otherReview] = await Promise.all([
      WordReview.findOne({ where: { userId, wordId: currentUserWord.id } }),
      WordReview.findOne({ where: { userId: otherUser.id, wordId: otherUserWord.id } }),
    ]);
    expect(currentReview).toBeTruthy();
    expect(otherReview).toBeTruthy();
  });

  it('导入未分类词根时会为目标用户自动创建默认词根并保持关联', async () => {
    const otherUser = await User.create({
      username: 'data_import_uncategorized_' + Date.now(),
      password: 'x',
    });
    const otherApp = buildApp(otherUser.id);

    const res = await request(otherApp).post('/review/data/import').send(uncategorizedSampleData);
    expect(res.status).toBe(200);
    expect(res.body.data.rootsAdded).toBe(1);
    expect(res.body.data.wordsAdded).toBe(1);

    const defaultRoot = await Root.findOne({ where: { userId: otherUser.id, isDefault: true } });
    const word = await Word.findOne({ where: { name: 'uncategorizedword', userId: otherUser.id } });
    const link = await WordRoot.findOne({ where: { wordId: word.id, rootId: defaultRoot.id } });

    expect(defaultRoot).toBeTruthy();
    expect(word).toBeTruthy();
    expect(link).toBeTruthy();
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

  it('导入时恢复单词复习进度', async () => {
    const progressData = {
      version: '1.0',
      exportedAt: '2026-01-01T00:00:00Z',
      roots: [{ name: 'progressroot', meaning: '进度词根', isDefault: false }],
      words: [
        {
          name: 'progressword',
          meaning: '有进度的单词',
          status: 'review',
          interval: 10,
          easeFactor: 2.8,
          dueDate: '2099-12-31',
          dueAt: null,
          reviewCount: 5,
          successCount: 4,
          perfectStreakCount: 2,
          rootNames: ['progressroot'],
          examples: [],
        },
      ],
    };

    const res = await request(app).post('/review/data/import').send(progressData);
    expect(res.status).toBe(200);
    expect(res.body.data.wordsAdded).toBe(1);

    const word = await Word.findOne({ where: { name: 'progressword', userId } });
    const review = await WordReview.findOne({ where: { userId, wordId: word.id } });
    expect(review).toBeTruthy();
    expect(review.status).toBe('review');
    expect(review.interval).toBe(10);
    expect(Number(review.easeFactor)).toBeCloseTo(2.8);
    expect(review.dueDate).toBe('2099-12-31');
    expect(review.reviewCount).toBe(5);
    expect(review.successCount).toBe(4);
    expect(review.perfectStreakCount).toBe(2);
  });

  it('重复导入时不覆盖已有复习进度', async () => {
    // progressword was imported in the previous test with status='review'
    // Manually change the review state and re-import; it must not be overwritten
    const word = await Word.findOne({ where: { name: 'progressword', userId } });
    await WordReview.update(
      { status: 'known', interval: 30 },
      { where: { userId, wordId: word.id } }
    );

    const progressData = {
      version: '1.0',
      exportedAt: '2026-01-01T00:00:00Z',
      roots: [{ name: 'progressroot', meaning: '进度词根', isDefault: false }],
      words: [
        {
          name: 'progressword',
          meaning: '有进度的单词',
          status: 'review',
          interval: 10,
          easeFactor: 2.8,
          dueDate: '2099-12-31',
          dueAt: null,
          reviewCount: 5,
          successCount: 4,
          perfectStreakCount: 2,
          rootNames: ['progressroot'],
          examples: [],
        },
      ],
    };

    const res = await request(app).post('/review/data/import').send(progressData);
    expect(res.status).toBe(200);
    expect(res.body.data.wordsAdded).toBe(0); // word already exists

    const review = await WordReview.findOne({ where: { userId, wordId: word.id } });
    expect(review.status).toBe('known'); // unchanged
    expect(review.interval).toBe(30); // unchanged
  });
});
