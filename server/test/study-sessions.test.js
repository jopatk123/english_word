/**
 * 测试：学习计时统计与服务端权威状态
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, StudySession } from '../models/index.js';
import { createStudySessionsRouter } from '../routes/study-sessions.js';
import { todayStart, tomorrowStart } from '../utils/srs.js';

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/study-sessions', createStudySessionsRouter());
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

describe('服务端权威计时状态', () => {
  it('重复 start 只返回同一个活跃会话，不会创建重复记录', async () => {
    const user = await User.create({ username: `timer_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const first = await request(app).post('/study-sessions/start').send({ note: 'first' });
    const second = await request(app).post('/study-sessions/start').send({ note: 'second' });
    const current = await request(app).get('/study-sessions/current');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.isRunning).toBe(true);
    expect(second.body.data.isRunning).toBe(true);
    expect(second.body.data.sessionId).toBe(first.body.data.sessionId);
    expect(current.body.data.sessionId).toBe(first.body.data.sessionId);

    const activeSessions = await StudySession.findAll({
      where: { userId: user.id, endedAt: null },
    });
    expect(activeSessions).toHaveLength(1);
  });

  it('过期的 stop 请求不会结束新的活跃会话', async () => {
    const user = await User.create({ username: `timer_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const staleSession = await StudySession.create({
      userId: user.id,
      startedAt: new Date(Date.now() - 60_000),
      endedAt: new Date(Date.now() - 30_000),
      durationSeconds: 30,
    });
    const activeSession = await StudySession.create({
      userId: user.id,
      startedAt: new Date(),
      note: 'active',
    });

    const res = await request(app).post(`/study-sessions/${staleSession.id}/end`);
    const activeAfter = await StudySession.findByPk(activeSession.id);

    expect(res.status).toBe(200);
    expect(res.body.data.isRunning).toBe(true);
    expect(res.body.data.sessionId).toBe(activeSession.id);
    expect(activeAfter.endedAt).toBeNull();
  });
});