import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { ensureWordReviewMock } = vi.hoisted(() => ({
  ensureWordReviewMock: vi.fn(),
}));

vi.mock('../utils/wordReview.js', async () => {
  const actual = await vi.importActual('../utils/wordReview.js');
  return {
    ...actual,
    ensureWordReview: (...args) => ensureWordReviewMock(...args),
  };
});

let initDB;
let User;
let Root;
let Word;
let WordRoot;
let wordsRouter;

const suffix = () => Date.now() + Math.random().toString(36).slice(2, 6);

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

beforeAll(async () => {
  const models = await import('../models/index.js');
  initDB = models.initDB;
  User = models.User;
  Root = models.Root;
  Word = models.Word;
  WordRoot = models.WordRoot;
  ({ default: wordsRouter } = await import('../routes/words.js'));
  await initDB();
});

beforeEach(() => {
  ensureWordReviewMock.mockReset();
  ensureWordReviewMock.mockRejectedValue(new Error('review create failed'));
});

describe('POST /words/ transaction integrity', () => {
  it('复习记录创建失败时会整体回滚单词和词根关联', async () => {
    const user = await User.create({ username: `wordtx_${suffix()}`, password: 'x' });
    const root = await Root.create({
      name: `txroot_${suffix()}`,
      meaning: '事务测试',
      userId: user.id,
    });
    const app = buildApp(user.id);
    const wordName = `rollback_${suffix()}`;

    const res = await request(app)
      .post('/words/')
      .send({ name: wordName, meaning: '应当回滚', rootIds: [root.id] });

    expect(res.status).toBe(500);

    const createdWord = await Word.findOne({
      where: { name: wordName.trim().toLowerCase(), userId: user.id },
    });
    expect(createdWord).toBeNull();

    const links = await WordRoot.findAll({
      include: [{ model: Root, as: 'root', attributes: ['id'] }],
      where: { rootId: root.id },
    });
    expect(links).toHaveLength(0);
  });
});
