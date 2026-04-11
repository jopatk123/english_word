/**
 * 测试：学习计时统计口径
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, StudySession } from '../models/index.js';
import studySessionsRouter from '../routes/study-sessions.js';
import { todayStart, tomorrowStart } from '../utils/srs.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/study-sessions', studySessionsRouter);
  return app;
};

const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
});

describe('GET /study-sessions/stats', () => {
  it('按用户时区统计今日学习时长，并计算跨午夜会话的重叠部分', async () => {
    const tz = 'Asia/Shanghai';
    const dayStart = todayStart(tz);
    const nextDayStart = tomorrowStart(tz);

    const user = await User.create({ username: `study_${suf()}`, password: 'x' });
    const isolatedApp = buildApp(user.id);

    await StudySession.create({
      userId: user.id,
      startedAt: new Date(dayStart.getTime() - 10 * 60 * 1000),
      endedAt: new Date(dayStart.getTime() + 10 * 60 * 1000),
      durationSeconds: 20 * 60,
    });

    await StudySession.create({
      userId: user.id,
      startedAt: new Date(dayStart.getTime() + 30 * 60 * 1000),
      endedAt: new Date(dayStart.getTime() + 40 * 60 * 1000),
      durationSeconds: 10 * 60,
    });

    // 额外制造一个落在明天的会话，确认今天窗口不会把明天部分算进去
    await StudySession.create({
      userId: user.id,
      startedAt: new Date(nextDayStart.getTime() + 5 * 60 * 1000),
      endedAt: new Date(nextDayStart.getTime() + 15 * 60 * 1000),
      durationSeconds: 10 * 60,
    });

    const res = await request(isolatedApp).get(`/study-sessions/stats?tz=${tz}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSeconds).toBe(40 * 60);
    expect(res.body.data.todaySeconds).toBe(20 * 60);
  });
});