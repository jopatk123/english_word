import { Router } from 'express';
import { Op } from 'sequelize';
import { StudySession } from '../models/index.js';
import { success, error } from '../utils/response.js';

const router = Router();

/**
 * POST /study-sessions/start
 * 开始一次学习计时，创建进行中的会话记录
 */
router.post('/start', async (req, res) => {
  try {
    // 先结束同一用户未关闭的会话（异常情况兜底）
    await StudySession.update(
      {
        endedAt: new Date(),
        durationSeconds: 0,
      },
      {
        where: {
          userId: req.userId,
          endedAt: null,
        },
      }
    );

    const { note } = req.body;
    const session = await StudySession.create({
      userId: req.userId,
      startedAt: new Date(),
      note: note || null,
    });

    success(res, { id: session.id, startedAt: session.startedAt });
  } catch (e) {
    error(res, e.message);
  }
});

/**
 * POST /study-sessions/:id/end
 * 结束一次学习计时，写入时长
 */
router.post('/:id/end', async (req, res) => {
  try {
    const session = await StudySession.findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return error(res, '记录不存在', 404);
    if (session.endedAt) return error(res, '该记录已结束', 400);

    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt - session.startedAt) / 1000);

    await session.update({ endedAt, durationSeconds });
    success(res, { id: session.id, durationSeconds });
  } catch (e) {
    error(res, e.message);
  }
});

/**
 * GET /study-sessions/stats
 * 返回总学习时长 + 今日时长 + 最近 N 条记录
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;

    // 总时长（所有已完成的会话）
    const allSessions = await StudySession.findAll({
      where: { userId, endedAt: { [Op.ne]: null } },
      attributes: ['durationSeconds', 'startedAt'],
      order: [['startedAt', 'DESC']],
    });

    const totalSeconds = allSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

    // 今日时长
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySeconds = allSessions
      .filter((s) => new Date(s.startedAt) >= todayStart)
      .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

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

export default router;
