import { Router } from 'express';
import { Op } from 'sequelize';
import { WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { todayStr, todayStartUTC, addDays } from '../../utils/srs.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const tz = req.query.tz;
    const today = todayStr(tz);
    const todayStart = todayStartUTC(tz);

    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const [totalCount, dueCount, newCount, learningCount, knownCount, todayReviewed, overdueCount, weekDueCount] = await Promise.all([
      WordReview.count({ where: { userId: req.userId } }),
      WordReview.count({ where: { userId: req.userId, paused: false, dueDate: { [Op.lte]: today } } }),
      WordReview.count({ where: { userId: req.userId, status: 'new' } }),
      WordReview.count({ where: { userId: req.userId, status: 'learning' } }),
      WordReview.count({ where: { userId: req.userId, status: 'known' } }),
      WordReview.count({
        where: {
          userId: req.userId,
          lastReviewedAt: { [Op.gte]: todayStart },
        },
      }),
      WordReview.count({ where: { userId: req.userId, paused: false, dueDate: { [Op.lt]: today } } }),
      WordReview.count({ where: { userId: req.userId, paused: false, dueDate: { [Op.gte]: weekStartStr, [Op.lte]: addDays(weekStartStr, 6) } } }),
    ]);

    success(res, {
      total: totalCount,
      due: dueCount,
      new: newCount,
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
