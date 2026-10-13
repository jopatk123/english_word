import { Router } from 'express';
import { Op } from 'sequelize';
import { WordReview } from '../../models/index.js';
import { success, handleRouteError } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';
import { buildScopeDueWhere, collectDuePoolIds } from '../../utils/dueFiller.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const tz = req.query.tz;
    const today = todayStr(tz);
    const todayStartDate = todayStart(tz);
    const now = new Date();
    const dueNowForToday = {
      [Op.or]: [{ dueAt: null }, { dueAt: { [Op.lte]: now } }],
    };

    const [totalCount, todayDueCount, knownCount, todayReviewed, overdueCount] = await Promise.all([
      WordReview.count({ where: { userId: req.userId } }),
      // 今日到期（仅 dueDate == today）
      WordReview.count({
        where: { userId: req.userId, dueDate: today, ...dueNowForToday },
      }),
      WordReview.count({ where: { userId: req.userId, status: REVIEW_STATUS.KNOWN } }),
      WordReview.count({
        where: {
          userId: req.userId,
          lastReviewedAt: { [Op.gte]: todayStartDate },
        },
      }),
      // 超期未复习（dueDate < today），与 todayDue 互斥
      WordReview.count({
        where: { userId: req.userId, dueDate: { [Op.lt]: today } },
      }),
    ]);

    const learningCount = Math.max(totalCount - knownCount, 0);
    // 与 GET /review/due?scope=due 使用同一套选词，保证仪表盘「待复习」等于实际队列长度
    // （真到期 + 补足 + 防饿死）。todayDue / overdue 仍只统计日历上的真到期。
    const duePoolIds = await collectDuePoolIds({
      userId: req.userId,
      dueWhere: buildScopeDueWhere(req.userId, today, now),
      dueOrder: [['id', 'ASC']],
      now,
    });
    // 已掌握复习：取已掌握单词的 10%（最少 1 个，最多 30 个）
    const knownReviewCount =
      knownCount > 0 ? Math.min(Math.max(Math.ceil(knownCount * 0.1), 1), 30) : 0;

    success(res, {
      total: totalCount,
      // due = 默认待复习队列长度（真到期 + 补足 + 防饿死）
      due: duePoolIds.length,
      todayDue: todayDueCount,
      new: 0,
      learning: learningCount,
      known: knownCount,
      knownReviewCount,
      todayReviewed,
      overdue: overdueCount,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
