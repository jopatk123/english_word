/**
 * 学习计时防挂死：硬上限、结束原因、断线宽限
 */
import http from 'http';
import express from 'express';
import request from 'supertest';
import WebSocket from 'ws';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { generateToken } from '../middleware/auth.js';
import { initDB, User, StudySession } from '../models/index.js';
import {
  MAX_SESSION_DURATION_SECONDS,
  STUDY_SESSION_END_REASONS,
} from '../constants/study-session.js';
import { createStudySessionsRouter } from '../routes/study-sessions.js';
import { createStudyTimerHub } from '../realtime/study-timer-hub.js';
import { getStudyTimerState } from '../services/study-timer-state.js';

const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

const buildApp = (userId, publishTimerState = async () => {}) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/study-sessions', createStudySessionsRouter({ publishTimerState }));
  return app;
};

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

let resources = [];

beforeAll(async () => {
  await initDB();
});

afterEach(async () => {
  vi.useRealTimers();
  while (resources.length) {
    const cleanup = resources.pop();
    await cleanup();
  }
});

describe('学习会话硬上限与结束原因', () => {
  it('GET /current 惰性结算：超过 120 分钟的活跃会话自动结束且时长封顶', async () => {
    const user = await User.create({ username: `max_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const startedAt = new Date(Date.now() - (MAX_SESSION_DURATION_SECONDS + 600) * 1000);
    const session = await StudySession.create({
      userId: user.id,
      startedAt,
    });

    const res = await request(app).get('/study-sessions/current');
    expect(res.status).toBe(200);
    expect(res.body.data.isRunning).toBe(false);

    await session.reload();
    expect(session.endedAt).not.toBeNull();
    expect(session.durationSeconds).toBe(MAX_SESSION_DURATION_SECONDS);
    expect(session.endReason).toBe(STUDY_SESSION_END_REASONS.MAX_DURATION);
  });

  it('POST /end 写入 manual / page_close 等结束原因', async () => {
    const user = await User.create({ username: `reason_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const start = await request(app).post('/study-sessions/start').send({});
    const sessionId = start.body.data.sessionId;

    const manual = await request(app).post(`/study-sessions/${sessionId}/end`).send({});
    expect(manual.body.data.isRunning).toBe(false);

    const manualRow = await StudySession.findByPk(sessionId);
    expect(manualRow.endReason).toBe(STUDY_SESSION_END_REASONS.MANUAL);

    const start2 = await request(app).post('/study-sessions/start').send({});
    const sessionId2 = start2.body.data.sessionId;
    await request(app)
      .post(`/study-sessions/${sessionId2}/end`)
      .send({ reason: STUDY_SESSION_END_REASONS.PAGE_CLOSE });

    const pageCloseRow = await StudySession.findByPk(sessionId2);
    expect(pageCloseRow.endReason).toBe(STUDY_SESSION_END_REASONS.PAGE_CLOSE);
  });

  it('getStudyTimerState 对进行中会话展示 elapsed 不超过硬上限', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    try {
      const user = await User.create({ username: `elapsed_${suf()}`, password: 'x' });
      const startedAt = new Date('2026-06-01T09:00:00.000Z');
      await StudySession.create({ userId: user.id, startedAt });

      const state = await getStudyTimerState(user.id, {
        serverNow: new Date('2026-06-01T12:00:00.000Z'),
      });

      expect(state.isRunning).toBe(false);
      const ended = await StudySession.findOne({ where: { userId: user.id } });
      expect(ended.durationSeconds).toBe(MAX_SESSION_DURATION_SECONDS);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('WebSocket 断线宽限', () => {
  it('全部连接断开后经过宽限时间自动结束（disconnect_grace）', async () => {
    const user = await User.create({ username: `grace_${suf()}`, password: 'x' });
    const token = generateToken(user);
    const studyTimerHub = createStudyTimerHub({
      disconnectGraceMs: 80,
      maxDurationSweepIntervalMs: 60_000,
    });
    const app = createApp({ studyTimerHub });
    const server = http.createServer(app);
    studyTimerHub.attach(server);

    resources.push(async () => {
      await studyTimerHub.close();
      await closeServer(server);
    });

    const address = await listen(server);
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/study-timer`, [token]);

    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const startRes = await request(app)
      .post('/api/study-sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const sessionId = startRes.body.data.sessionId;
    expect(startRes.body.data.isRunning).toBe(true);

    await new Promise((resolve) => {
      socket.once('close', resolve);
      socket.close();
    });

    await new Promise((resolve) => setTimeout(resolve, 40));
    let row = await StudySession.findByPk(sessionId);
    expect(row.endedAt).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 60));
    row = await StudySession.findByPk(sessionId);
    expect(row.endedAt).not.toBeNull();
    expect(row.endReason).toBe(STUDY_SESSION_END_REASONS.DISCONNECT_GRACE);
  });

  it('仍有一个 WebSocket 连接时，关闭另一个标签不会触发断线宽限停表', async () => {
    const user = await User.create({ username: `multitab_${suf()}`, password: 'x' });
    const token = generateToken(user);
    const studyTimerHub = createStudyTimerHub({
      disconnectGraceMs: 80,
      maxDurationSweepIntervalMs: 60_000,
    });
    const app = createApp({ studyTimerHub });
    const server = http.createServer(app);
    studyTimerHub.attach(server);

    resources.push(async () => {
      await studyTimerHub.close();
      await closeServer(server);
    });

    const address = await listen(server);
    const socketA = new WebSocket(`ws://127.0.0.1:${address.port}/ws/study-timer`, [token]);
    const socketB = new WebSocket(`ws://127.0.0.1:${address.port}/ws/study-timer`, [token]);

    await Promise.all([
      new Promise((resolve, reject) => {
        socketA.once('open', resolve);
        socketA.once('error', reject);
      }),
      new Promise((resolve, reject) => {
        socketB.once('open', resolve);
        socketB.once('error', reject);
      }),
    ]);

    const startRes = await request(app)
      .post('/api/study-sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const sessionId = startRes.body.data.sessionId;

    await new Promise((resolve) => {
      socketA.once('close', resolve);
      socketA.close();
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    const row = await StudySession.findByPk(sessionId);
    expect(row.endedAt).toBeNull();

    await new Promise((resolve) => {
      socketB.once('close', resolve);
      socketB.close();
    });
  });
});
