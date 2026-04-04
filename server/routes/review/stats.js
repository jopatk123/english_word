import { Router } from 'express';
import { Op } from 'sequelize';
import { WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { todayStr, todayStart, addDays } from '../../utils/srs.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const tz = req.query.tz;
    const today = todayStr(tz);
    const todayStartDate = todayStart(tz);
    const tomorrow = addDays(today, 1);

    // 计算本周日（含）日期字符串
    const todayDate = new Date(today + 'T12:00:00Z');
    const dayOfWeek = todayDate.getUTCDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEndStr = addDays(today, daysUntilSunday);

    const [
      totalCount,
      todayDueCount,
      knownCount,
      todayReviewed,
      overdueCount,
      weekDueCount,
    ] = await Promise.all([
      WordReview.count({ where: { userId: req.userId, paused: false } }),
      // 今日到期（仅 dueDate == today）
      WordReview.count({
        where: { userId: req.userId, paused: false, dueDate: today },
      }),
      WordReview.count({ where: { userId: req.userId, paused: false, status: 'known' } }),
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
      // 本周剩余（明天 ~ 本周日），不包含今日和超期
      WordReview.count({
        where: {
          userId: req.userId,
          paused: false,
          dueDate: { [Op.gte]: tomorrow, [Op.lte]: weekEndStr },
        },
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
      weekDue: weekDueCount,
    });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
