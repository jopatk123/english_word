import { Router } from 'express';
import { Op } from 'sequelize';
import { WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';
import { computeMinDueCount } from '../../utils/dueFiller.js';

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
    const rawDue = todayDueCount + overdueCount;
    // 与 /review/due 的补足规则保持一致：due 数量不少于 ceil(learning/3)
    // 让仪表盘"待复习"数字与实际进入复习队列的数量一致
    const filledDue = Math.max(rawDue, computeMinDueCount(learningCount));

    success(res, {
      total: totalCount,
      // due = 今日到期 + 超期，再按补足规则下限抬升，代表"现在需要复习的总量"
      due: filledDue,
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
