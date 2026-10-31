/**
 * 测试：GET /vocabulary/audit 轻量词库审计
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root, Word, WordRoot, Example } from '../models/index.js';
import vocabularyRouter from '../routes/vocabulary.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/vocabulary', vocabularyRouter);
  return app;
};

let app;
let userId;
const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `audittest_${suf()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  await ensureDefaultRoot(userId);

  const realRoot = await Root.create({ name: `audit_root_${suf()}`, meaning: '有单词', userId });
  const orphanRoot = await Root.create({
    name: `audit_orphan_${suf()}`,
    meaning: '空词根',
    userId,
  });
  void orphanRoot;

  const classified = await Word.create({
    name: `auditword_${suf()}`,
    meaning: '分类词',
    phonetic: '/x/',
    userId,
  });
  await WordRoot.create({ wordId: classified.id, rootId: realRoot.id });
  await Example.create({
    wordId: classified.id,
    sentence: 'This sentence never mentions the lemma.',
    translation: '不含词条',
  });
  await Example.create({
    wordId: classified.id,
    sentence: `Use ${classified.name} here.`,
    translation: '含词条',
  });

  const uncategorized = await Word.create({
    name: `audituncat_${suf()}`,
    meaning: '未分类词',
    userId,
  });
  const defaultRoot = await ensureDefaultRoot(userId);
  await WordRoot.create({ wordId: uncategorized.id, rootId: defaultRoot.id });
});

describe('GET /vocabulary/audit', () => {
  it('返回计数与样本，默认不含例句正文', async () => {
    const res = await request(app).get('/vocabulary/audit?minExamples=2&sampleLimit=20');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totals.words).toBeGreaterThanOrEqual(2);
    expect(data.totals.roots).toBeGreaterThanOrEqual(3);
    expect(data.fewExamples.count).toBeGreaterThanOrEqual(1);
    expect(data.fewExamples.minExamples).toBe(2);
    expect(data.fewExamples.sample.length).toBeLessThanOrEqual(20);
    expect(data.fewExamples.sample.every((item) => item.exampleCount < 2)).toBe(true);
    expect(data.onlyDefaultRoot.count).toBeGreaterThanOrEqual(1);
    expect(data.onlyDefaultRoot.sample[0]).toHaveProperty('id');
    expect(data.onlyDefaultRoot.sample[0]).toHaveProperty('name');
    expect(data.orphanRoots.count).toBeGreaterThanOrEqual(1);
    expect(data.orphanRoots.excludeDefault).toBe(true);
    expect(data.missingPhonetic.count).toBeGreaterThanOrEqual(1);
    expect(data.noImage.count).toBeGreaterThanOrEqual(2);
    expect(data.lemmaMissingInExamples.count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(data)).not.toMatch(/This sentence never mentions/);
  });

  it('lemmaCheck=0 可跳过软词形检查', async () => {
    const res = await request(app).get('/vocabulary/audit?lemmaCheck=0');
    expect(res.status).toBe(200);
    expect(res.body.data.lemmaMissingInExamples).toEqual({ count: 0, sample: [] });
  });
});
