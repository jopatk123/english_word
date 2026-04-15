/**
 * 测试：学习计时统计与服务端权威状态
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, StudySession } from '../models/index.js';
import { createStudySessionsRouter } from '../routes/study-sessions.js';
import { todayStart, tomorrowStart, dateStrAt } from '../utils/srs.js';

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

// ============================================================
// GET /study-sessions/report 学习时间报表
// ============================================================

/** 快速创建一条已完成的会话，start/end 均为 Date 对象 */
async function makeSession(userId, startDate, durationSeconds) {
  const endDate = new Date(startDate.getTime() + durationSeconds * 1000);
  return StudySession.create({
    userId,
    startedAt: startDate,
    endedAt: endDate,
    durationSeconds,
  });
}

describe('GET /study-sessions/report', () => {
  const tz = 'Asia/Shanghai';

  it('无会话时返回全零统计，dailyBuckets 数量等于 days', async () => {
    const user = await User.create({ username: `rpt_empty_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totalSeconds).toBe(0);
    expect(d.sevenDaySeconds).toBe(0);
    expect(d.thirtyDaySeconds).toBe(0);
    expect(d.streakDays).toBe(0);
    expect(d.totalSessions).toBe(0);
    expect(d.recentSessions).toHaveLength(0);
    // 默认 days=30
    expect(d.dailyBuckets).toHaveLength(30);
  });

  it('days 参数正确控制 dailyBuckets 长度（7 / 90）', async () => {
    const user = await User.create({ username: `rpt_days_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const [r7, r90] = await Promise.all([
      request(app).get(`/study-sessions/report?tz=${tz}&days=7`),
      request(app).get(`/study-sessions/report?tz=${tz}&days=90`),
    ]);
    expect(r7.body.data.dailyBuckets).toHaveLength(7);
    expect(r90.body.data.dailyBuckets).toHaveLength(90);
  });

  it('days 参数超出范围时自动截断到 [7, 90]', async () => {
    const user = await User.create({ username: `rpt_clamp_${suf()}`, password: 'x' });
    const app = buildApp(user.id);

    const [rLow, rHigh] = await Promise.all([
      request(app).get(`/study-sessions/report?tz=${tz}&days=3`),
      request(app).get(`/study-sessions/report?tz=${tz}&days=200`),
    ]);
    expect(rLow.body.data.dailyBuckets).toHaveLength(7);
    expect(rHigh.body.data.dailyBuckets).toHaveLength(90);
  });

  it('totalSeconds 等于所有已完成会话 durationSeconds 之和', async () => {
    const user = await User.create({ username: `rpt_total_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    await makeSession(user.id, new Date(today.getTime() + 1 * 60 * 60_000), 30 * 60);
    await makeSession(user.id, new Date(today.getTime() + 2 * 60 * 60_000), 20 * 60);

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    expect(res.body.data.totalSeconds).toBe(50 * 60);
    expect(res.body.data.totalSessions).toBe(2);
    expect(res.body.data.avgSessionSeconds).toBe(25 * 60);
  });

  it('sevenDaySeconds / thirtyDaySeconds 仅计算对应窗口内的部分（跨中午会话使用 overlap）', async () => {
    const user = await User.create({ username: `rpt_windows_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);
    const _35DaysAgo = new Date(today.getTime() - 35 * 24 * 60 * 60_000 + 60 * 60_000);
    const _10DaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60_000 + 60 * 60_000);

    // 35 天前的会话 → 不在 7/30 天窗口内
    await makeSession(user.id, _35DaysAgo, 60 * 60);
    // 10 天前的会话 → 在 30 天内但不在 7 天内
    await makeSession(user.id, _10DaysAgo, 30 * 60);
    // 今天的会话
    await makeSession(user.id, new Date(today.getTime() + 60 * 60_000), 20 * 60);

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    const d = res.body.data;

    expect(d.totalSeconds).toBe((60 + 30 + 20) * 60);
    expect(d.thirtyDaySeconds).toBe((30 + 20) * 60); // 35天前的排除
    expect(d.sevenDaySeconds).toBe(20 * 60);          // 只今天
  });

  it('dailyBuckets 今天的桶秒数与今日会话匹配', async () => {
    const user = await User.create({ username: `rpt_bucket_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    await makeSession(user.id, new Date(today.getTime() + 60 * 60_000), 45 * 60);

    const res = await request(app).get(`/study-sessions/report?tz=${tz}&days=7`);
    const d = res.body.data;
    const todayStr = dateStrAt(today, tz);
    const todayBucket = d.dailyBuckets.find((b) => b.date === todayStr);

    expect(todayBucket).toBeDefined();
    expect(todayBucket.seconds).toBe(45 * 60);
    // 其余 6 天为 0
    const otherBuckets = d.dailyBuckets.filter((b) => b.date !== todayStr);
    expect(otherBuckets.every((b) => b.seconds === 0)).toBe(true);
  });

  it('avgDailySeconds 基于活跃天数而非总天数', async () => {
    const user = await User.create({ username: `rpt_avg_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    // 今天 60分、昨天 40分（共 2 天活跃，30天范围 28 天为 0）
    await makeSession(user.id, new Date(today.getTime() + 60 * 60_000), 60 * 60);
    await makeSession(
      user.id,
      new Date(today.getTime() - 24 * 60 * 60_000 + 60 * 60_000),
      40 * 60
    );

    const res = await request(app).get(`/study-sessions/report?tz=${tz}&days=30`);
    const d = res.body.data;

    expect(d.activeDaysInRange).toBe(2);
    expect(d.avgDailySeconds).toBe(Math.round((60 + 40) * 60 / 2));
  });

  it('streakDays 连续天数从今日起逆序计算', async () => {
    const user = await User.create({ username: `rpt_streak3_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    // 今天、昨天、前天各一次
    for (let i = 0; i < 3; i++) {
      await makeSession(
        user.id,
        new Date(today.getTime() - i * 24 * 60 * 60_000 + 60 * 60_000),
        30 * 60
      );
    }

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    expect(res.body.data.streakDays).toBe(3);
  });

  it('streak 中断后只计算包含今日的连续段', async () => {
    const user = await User.create({ username: `rpt_streak_gap_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    // 今天和前天（跳过昨天）
    for (const offsetDays of [0, 2]) {
      await makeSession(
        user.id,
        new Date(today.getTime() - offsetDays * 24 * 60 * 60_000 + 60 * 60_000),
        30 * 60
      );
    }

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    expect(res.body.data.streakDays).toBe(1); // 只有今天连续
  });

  it('若今天无会话则 streakDays 为 0（即使昨天有）', async () => {
    const user = await User.create({ username: `rpt_streak0_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    // 仅昨天有会话
    await makeSession(
      user.id,
      new Date(today.getTime() - 24 * 60 * 60_000 + 60 * 60_000),
      30 * 60
    );

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    expect(res.body.data.streakDays).toBe(0);
  });

  it('recentSessions 最多返回 10 条，按时间倒序', async () => {
    const user = await User.create({ username: `rpt_recent_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const base = Date.now() - 15 * 60 * 60_000;

    for (let i = 0; i < 15; i++) {
      await makeSession(user.id, new Date(base + i * 60 * 60_000), 30 * 60);
    }

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    const sessions = res.body.data.recentSessions;

    expect(sessions).toHaveLength(10);
    // 最新的会话排在第一位
    expect(new Date(sessions[0].startedAt).getTime()).toBeGreaterThan(
      new Date(sessions[1].startedAt).getTime()
    );
  });

  it('进行中的会话（endedAt=null）不计入统计', async () => {
    const user = await User.create({ username: `rpt_active_${suf()}`, password: 'x' });
    const app = buildApp(user.id);
    const today = todayStart(tz);

    // 一条已完成的会话
    await makeSession(user.id, new Date(today.getTime() + 60 * 60_000), 30 * 60);
    // 一条进行中的会话（无 endedAt）
    await StudySession.create({
      userId: user.id,
      startedAt: new Date(today.getTime() + 3 * 60 * 60_000),
    });

    const res = await request(app).get(`/study-sessions/report?tz=${tz}`);
    expect(res.body.data.totalSessions).toBe(1);
    expect(res.body.data.totalSeconds).toBe(30 * 60);
  });
});