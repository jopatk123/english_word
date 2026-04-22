import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { sequelize, Word, Root, WordReview, ReviewHistory } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { getNextReview, todayStr, buildDueSchedule } from '../../utils/srs.js';

const router = Router();

// 将某词根下的单词加入学习队列
router.post('/enqueue', async (req, res) => {
  try {
    const { rootId } = req.body;
    if (!rootId) return error(res, '请提供词根ID', 400);

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await root.getWords({ where: { userId: req.userId } });
    if (words.length === 0) return error(res, '该词根下没有单词', 400);

    const today = todayStr(req.body.tz);
    const now = new Date();
    let addedCount = 0;

    for (const word of words) {
      const [, created] = await WordReview.findOrCreate({
        where: { userId: req.userId, wordId: word.id },
        defaults: {
          userId: req.userId,
          wordId: word.id,
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          dueDate: today,
          dueAt: now,
          reviewCount: 0,
          successCount: 0,
        },
      });
      if (created) addedCount++;
    }

    success(
      res,
      { added: addedCount, total: words.length },
      `已添加 ${addedCount} 个新单词到学习队列`
    );
  } catch (e) {
    error(res, e.message);
  }
});

// 提交复习结果
router.post('/:wordId/result', async (req, res) => {
  try {
    const { wordId } = req.params;
    const { quality } = req.body;

    if (![1, 2, 3, 4].includes(quality)) {
      return error(res, 'quality 必须是 1-4 之间的整数', 400);
    }

    const updatedReview = await sequelize.transaction(async (transaction) => {
      const review = await WordReview.findOne({
        where: { userId: req.userId, wordId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!review) {
        const notFoundError = new Error('该单词不在学习队列中');
        notFoundError.code = 404;
        throw notFoundError;
      }

      const oldInterval = review.interval;
      const oldEase = review.easeFactor;
      const successCount = Math.max(0, Math.trunc(Number(review.successCount) || 0));
      const nextSuccessCount = successCount + (quality >= 3 ? 1 : 0);
      const { interval, delayMinutes, easeFactor, status } = getNextReview(
        quality,
        review.interval,
        review.easeFactor,
        review.status,
        review.reviewCount,
        successCount
      );
      const { dueAt, dueDate } = buildDueSchedule(delayMinutes, req.body.tz);
      const reviewedAt = new Date();

      await ReviewHistory.create(
        {
          userId: req.userId,
          wordId: parseInt(wordId),
          quality,
          intervalBefore: oldInterval,
          intervalAfter: interval,
          easeFactorBefore: oldEase,
          easeFactorAfter: easeFactor,
          reviewedAt,
        },
        { transaction }
      );

      return review.update(
        {
          status,
          interval,
          easeFactor,
          dueDate,
          dueAt,
          reviewCount: review.reviewCount + 1,
          successCount: nextSuccessCount,
          lastReviewedAt: reviewedAt,
        },
        { transaction }
      );
    });

    success(res, updatedReview);
  } catch (e) {
    error(res, e.message, e.code || 500);
  }
});

// 获取选择题干扰项
router.get('/quiz-choices/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;
    const count = Math.min(parseInt(req.query.count) || 3, 5);

    const word = await Word.findOne({
      where: { id: wordId, userId: req.userId },
      attributes: ['id', 'name', 'meaning'],
    });
    if (!word) return error(res, '单词不存在', 404);

    const distractors = await Word.findAll({
      where: { userId: req.userId, id: { [Op.ne]: wordId } },
      attributes: ['id', 'name', 'meaning'],
      order: literal('RANDOM()'),
      limit: count,
    });

    success(res, {
      correct: { id: word.id, name: word.name, meaning: word.meaning },
      distractors: distractors.map((d) => ({ id: d.id, name: d.name, meaning: d.meaning })),
    });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
