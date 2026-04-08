import { Router } from 'express';
import { Op } from 'sequelize';
import { WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';

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
      WordReview.count({ where: { userId: req.userId, paused: false } }),
      // 今日到期（仅 dueDate == today）
      WordReview.count({
        where: { userId: req.userId, paused: false, dueDate: today, ...dueNowForToday },
      }),
      WordReview.count({ where: { userId: req.userId, paused: false, status: REVIEW_STATUS.KNOWN } }),
      WordReview.count({
        where: {
          userId: req.userId,
          paused: false,
          lastReviewedAt: { [Op.gte]: todayStartDate },
        },
      }),
      // 超期未复习（dueDate < today），与 todayDue 互斥
      WordReview.count({
        where: { userId: req.userId, paused: false, dueDate: { [Op.lt]: today } },
      }),
    ]);

    const learningCount = Math.max(totalCount - knownCount, 0);

    success(res, {
      total: totalCount,
      // due = 今日到期 + 超期，代表"现在需要复习的总量"
      due: todayDueCount + overdueCount,
      todayDue: todayDueCount,
      new: 0,
      learning: learningCount,
      known: knownCount,
      todayReviewed,
      overdue: overdueCount,
    });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
