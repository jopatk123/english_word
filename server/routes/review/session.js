import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { sequelize, Word, WordReview, ReviewHistory } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { getNextReview, buildDueSchedule } from '../../utils/srs.js';
import { ensureWordReview } from '../../utils/wordReview.js';

const router = Router();

// 提交复习结果
router.post('/:wordId/result', async (req, res) => {
  try {
    const { wordId } = req.params;
    const { quality } = req.body;

    if (![1, 2, 3, 4].includes(quality)) {
      return error(res, 'quality 必须是 1-4 之间的整数', 400);
    }

    const updatedReview = await sequelize.transaction(async (transaction) => {
      const normalizedWordId = parseInt(wordId, 10);

      const word = await Word.findOne({
        where: { id: normalizedWordId, userId: req.userId },
        attributes: ['id'],
        transaction,
      });
      if (!word) {
        const notFoundError = new Error('单词不存在');
        notFoundError.code = 404;
        throw notFoundError;
      }

      let review = await WordReview.findOne({
        where: { userId: req.userId, wordId: normalizedWordId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!review) {
        await ensureWordReview(req.userId, normalizedWordId, {
          timezone: req.body.tz,
          transaction,
        });
        review = await WordReview.findOne({
          where: { userId: req.userId, wordId: normalizedWordId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      }

      const oldInterval = review.interval;
      const oldEase = review.easeFactor;
      const successCount = Math.max(0, Math.trunc(Number(review.successCount) || 0));
      const perfectStreakCount = Math.max(0, Math.trunc(Number(review.perfectStreakCount) || 0));
      const nextSuccessCount = successCount + (quality >= 3 ? 1 : 0);
      const {
        interval,
        delayMinutes,
        easeFactor,
        status,
        perfectStreakCount: nextPerfectStreakCount,
      } = getNextReview(
        quality,
        review.interval,
        review.easeFactor,
        review.status,
        review.reviewCount,
        successCount,
        perfectStreakCount
      );
      const { dueAt, dueDate } = buildDueSchedule(delayMinutes, req.body.tz);
      const reviewedAt = new Date();

      await ReviewHistory.create(
        {
          userId: req.userId,
          wordId: normalizedWordId,
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
          perfectStreakCount: nextPerfectStreakCount,
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
