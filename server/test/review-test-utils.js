import express from 'express';
import { sequelize, initDB, User, Root, Word, WordRoot } from '../models/index.js';
import sessionRouter from '../routes/review/session.js';
import dueRouter from '../routes/review/due.js';
import statsRouter from '../routes/review/stats.js';
import manageRouter from '../routes/review/manage.js';
import historyRouter from '../routes/review/history.js';

export const createTestSuffix = () => Date.now() + Math.random().toString(36).slice(2, 5);

export const buildReviewApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/review', dueRouter);
  app.use('/review', statsRouter);
  app.use('/review', historyRouter);
  app.use('/review', manageRouter);
  app.use('/review', sessionRouter);
  return app;
};

export const createReviewFixture = async () => {
  await sequelize.drop().catch(() => {});
  await initDB();

  const user = await User.create({ username: `revtest_${createTestSuffix()}`, password: 'x' });
  const app = buildReviewApp(user.id);
  const root = await Root.create({ name: `rroot_${createTestSuffix()}`, meaning: '词根', userId: user.id });
  const word = await Word.create({ name: `rword_${createTestSuffix()}`, meaning: '含义', userId: user.id });

  await WordRoot.create({ wordId: word.id, rootId: root.id });

  return {
    app,
    userId: user.id,
    rootId: root.id,
    wordId: word.id,
  };
};