import { Router } from 'express';
import { Op } from 'sequelize';
import { StudySession } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { todayStart, tomorrowStart, dateStrAt, addDays, startOfDay } from '../utils/srs.js';
import {
  closeOtherActiveStudySessions,
  findActiveStudySession,
  getStudyTimerState,
} from '../services/study-timer-state.js';

function getOverlapSeconds(start, end, windowStart, windowEnd) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  const overlapStart = Math.max(startMs, windowStartMs);
  const overlapEnd = Math.min(endMs, windowEndMs);
  if (!Number.isFinite(overlapStart) || !Number.isFinite(overlapEnd) || overlapEnd <= overlapStart) {
    return 0;
  }

  return Math.floor((overlapEnd - overlapStart) / 1000);
}

export function createStudySessionsRouter(options = {}) {
  const router = Router();
  const publishTimerState = options.publishTimerState || (async () => {});

  /**
   * GET /study-sessions/current
   * 返回当前服务端权威计时状态
   */
  router.get('/current', async (req, res) => {
    try {
      success(res, await getStudyTimerState(req.userId));
    } catch (e) {
      error(res, e.message);
    }
  });

  /**
   * POST /study-sessions/start
   * 开始一次学习计时；若已存在进行中的会话，则直接返回当前权威状态。
   * 使用数据库唯一部分索引（idx_study_sessions_active）防止并发重复创建；
   * 捕获唯一约束冲突并幂等回退到已有会话。
   */
  router.post('/start', async (req, res) => {
    try {
      const activeSession = await findActiveStudySession(req.userId);
      if (activeSession) {
        await closeOtherActiveStudySessions(req.userId, activeSession.id);
        return success(
          res,
          await getStudyTimerState(req.userId, {
            activeSession,
            lastSession: activeSession,
          })
        );
      }

      const { note } = req.body;
      let session;
      try {
        session = await StudySession.create({
          userId: req.userId,
          startedAt: new Date(),
          note: note || null,
        });
      } catch (createErr) {
        // 并发请求触发唯一约束冲突时（两个请求都通过了上面的 findActive 检查），
        // 幂等地返回已有的活跃会话状态。
        if (createErr?.name === 'SequelizeUniqueConstraintError') {
          const existing = await findActiveStudySession(req.userId);
          if (existing) {
            return success(
              res,
              await getStudyTimerState(req.userId, { activeSession: existing, lastSession: existing })
            );
          }
        }
        throw createErr;
      }

      const state = await getStudyTimerState(req.userId, {
        activeSession: session,
        lastSession: session,
      });
      await publishTimerState(req.userId);
      return success(res, state);
    } catch (e) {
      return error(res, e.message);
    }
  });

  /**
   * POST /study-sessions/:id/end
   * 结束一次学习计时；若当前活跃会话已变化，则返回当前权威状态并保持幂等
   */
  router.post('/:id/end', async (req, res) => {
    try {
      const activeSession = await findActiveStudySession(req.userId);
      if (!activeSession) {
        return success(res, await getStudyTimerState(req.userId));
      }

      await closeOtherActiveStudySessions(req.userId, activeSession.id);

      if (String(activeSession.id) !== String(req.params.id)) {
        return success(
          res,
          await getStudyTimerState(req.userId, {
            activeSession,
            lastSession: activeSession,
          })
        );
      }

      const endedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(activeSession.startedAt).getTime()) / 1000)
      );

      await activeSession.update({ endedAt, durationSeconds });

      const state = await getStudyTimerState(req.userId);
      await publishTimerState(req.userId);
      return success(res, state);
    } catch (e) {
      return error(res, e.message);
    }
  });

  /**
   * GET /study-sessions/stats
   * 返回总学习时长 + 今日时长 + 最近 N 条记录
   */
  router.get('/stats', async (req, res) => {
    try {
      const userId = req.userId;
      const tz = req.query.tz;

      // 总时长（所有已完成的会话）
      const allSessions = await StudySession.findAll({
        where: { userId, endedAt: { [Op.ne]: null } },
        attributes: ['id', 'durationSeconds', 'startedAt', 'endedAt', 'note'],
        order: [['startedAt', 'DESC']],
      });

      const totalSeconds = allSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

      // 今日时长（按用户时区统计会话与今日时间窗的重叠部分）
      const todayWindowStart = todayStart(tz);
      const tomorrowWindowStart = tomorrowStart(tz);
      const todaySeconds = allSessions.reduce(
        (sum, s) =>
          sum + getOverlapSeconds(s.startedAt, s.endedAt, todayWindowStart, tomorrowWindowStart),
        0
      );

      // 最近 30 条
      const recentSessions = allSessions.slice(0, 30).map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: s.durationSeconds,
        note: s.note,
      }));

      success(res, { totalSeconds, todaySeconds, recentSessions });
    } catch (e) {
      error(res, e.message);
    }
  });

  /**
   * GET /study-sessions/report
   * 学习时间报表：总时长 + 近 7/30 天 + 连续打卡天数 + 日粒度桶 + 最近 10 条记录
   *
   * @query {number} days  日粒度桶范围，接受 7/30/90，默认 30，超出范围自动截断
   * @query {string} tz    IANA 时区名，如 'Asia/Shanghai'
   */
  router.get('/report', async (req, res) => {
    try {
      const userId = req.userId;
      const tz = req.query.tz;
      // 将 days 限制在 [7, 90] 区间，防止超大查询
      const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 90);

      // 拉取所有已完成会话（按时间正序，便于逐条遍历）
      const allSessions = await StudySession.findAll({
        where: { userId, endedAt: { [Op.ne]: null } },
        attributes: ['id', 'startedAt', 'endedAt', 'durationSeconds', 'note'],
        order: [['startedAt', 'ASC']],
      });

      // ── 全量汇总 ──────────────────────────────────────────────────────────
      const totalSeconds = allSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      const totalSessions = allSessions.length;
      const avgSessionSeconds =
        totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;

      // ── 固定窗口（7 天 / 30 天），与 days 参数无关 ──────────────────────
      const todayWindowStart = todayStart(tz);
      const tomorrowWindowStart = tomorrowStart(tz);
      const todayDateStr = dateStrAt(todayWindowStart, tz);

      const sevenDayWindowStart = startOfDay(addDays(todayDateStr, -6), tz);
      const thirtyDayWindowStart = startOfDay(addDays(todayDateStr, -29), tz);

      const sevenDaySeconds = allSessions.reduce(
        (sum, s) =>
          sum + getOverlapSeconds(s.startedAt, s.endedAt, sevenDayWindowStart, tomorrowWindowStart),
        0
      );
      const thirtyDaySeconds = allSessions.reduce(
        (sum, s) =>
          sum +
          getOverlapSeconds(s.startedAt, s.endedAt, thirtyDayWindowStart, tomorrowWindowStart),
        0
      );

      // ── 日粒度桶（按 days 参数决定覆盖范围） ────────────────────────────
      const startDateStr = addDays(todayDateStr, -(days - 1));
      const dailyBuckets = Array.from({ length: days }, (_, i) => {
        const bucketDateStr = addDays(startDateStr, i);
        const bucketDayStart = startOfDay(bucketDateStr, tz);
        const bucketDayEnd = startOfDay(addDays(bucketDateStr, 1), tz);
        const seconds = allSessions.reduce(
          (sum, s) => sum + getOverlapSeconds(s.startedAt, s.endedAt, bucketDayStart, bucketDayEnd),
          0
        );
        return { date: bucketDateStr, seconds };
      });

      // ── 日均（仅统计活跃天，排除未学习的天） ────────────────────────────
      const activeDaysInRange = dailyBuckets.filter((b) => b.seconds > 0).length;
      const rangeSeconds = dailyBuckets.reduce((sum, b) => sum + b.seconds, 0);
      const avgDailySeconds =
        activeDaysInRange > 0 ? Math.round(rangeSeconds / activeDaysInRange) : 0;

      // ── 连续学习天数（从今日起逆序检查，最多回溯 365 天） ────────────────
      const studiedDateSet = new Set(
        allSessions.map((s) => dateStrAt(new Date(s.startedAt), tz))
      );
      let streakDays = 0;
      let checkStr = todayDateStr;
      while (streakDays < 365 && studiedDateSet.has(checkStr)) {
        streakDays++;
        checkStr = addDays(checkStr, -1);
      }

      // ── 最近 10 条记录（时间倒序，方便前端直接渲染） ─────────────────────
      const recentSessions = [...allSessions]
        .reverse()
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationSeconds: s.durationSeconds,
          note: s.note || null,
        }));

      success(res, {
        totalSeconds,
        sevenDaySeconds,
        thirtyDaySeconds,
        streakDays,
        totalSessions,
        avgSessionSeconds,
        avgDailySeconds,
        activeDaysInRange,
        dailyBuckets,
        recentSessions,
      });
    } catch (e) {
      error(res, e.message);
    }
  });

  /**
   * GET /study-sessions/export
   * 导出全部学习记录（JSON 附件）
   */
  router.get('/export', async (req, res) => {
    try {
      const sessions = await StudySession.findAll({
        where: { userId: req.userId, endedAt: { [Op.ne]: null } },
        attributes: ['id', 'startedAt', 'endedAt', 'durationSeconds', 'note', 'created_at'],
        order: [['startedAt', 'DESC']],
      });

      const data = {
        exportedAt: new Date().toISOString(),
        sessions: sessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationSeconds: s.durationSeconds,
          durationMinutes: Math.round(s.durationSeconds / 60),
          note: s.note || '',
        })),
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=study-sessions.json');
      res.json(data);
    } catch (e) {
      error(res, e.message);
    }
  });

  return router;
}

export default createStudySessionsRouter();
