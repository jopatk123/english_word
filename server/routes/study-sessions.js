import { Router } from 'express';
import { Op } from 'sequelize';
import { StudySession } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { todayStart, tomorrowStart } from '../utils/srs.js';
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
   * 开始一次学习计时；若已存在进行中的会话，则直接返回当前权威状态
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
      const session = await StudySession.create({
        userId: req.userId,
        startedAt: new Date(),
        note: note || null,
      });

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
