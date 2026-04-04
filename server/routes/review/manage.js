import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, WordRoot, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { todayStr } from '../../utils/srs.js';

const router = Router();

// 获取词根列表及其学习进度
router.get('/roots-progress', async (req, res) => {
  try {
    const roots = await Root.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: Word,
          as: 'words',
          through: { attributes: [] },
          attributes: ['id'],
          include: [
            {
              model: WordReview,
              as: 'reviews',
              where: { userId: req.userId },
              required: false,
              attributes: ['status'],
            },
          ],
        },
      ],
      order: [['create_time', 'DESC']],
    });

    const result = roots.map((r) => {
      const wordCount = r.words.length;
      let enrolled = 0,
        known = 0;
      r.words.forEach((w) => {
        if (w.reviews && w.reviews.length > 0) {
          enrolled++;
          if (w.reviews[0].status === 'known') known++;
        }
      });
      return {
        id: r.id,
        name: r.name,
        meaning: r.meaning,
        isDefault: r.isDefault,
        wordCount,
        enrolled,
        known,
      };
    });

    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

// 重置某单词学习进度
router.post('/:wordId/reset', async (req, res) => {
  try {
    const { wordId } = req.params;
    const review = await WordReview.findOne({
      where: { userId: req.userId, wordId },
    });
    if (!review) return error(res, '该单词不在学习队列中', 404);

    await review.update({
      status: 'new',
      interval: 0,
      easeFactor: 2.5,
      dueDate: todayStr(),
      reviewCount: 0,
      lastReviewedAt: null,
    });

    success(res, review, '已重置学习进度');
  } catch (e) {
    error(res, e.message);
  }
});

// 从学习队列中移除
router.delete('/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;
    const review = await WordReview.findOne({
      where: { userId: req.userId, wordId },
    });
    if (!review) return error(res, '该单词不在学习队列中', 404);

    await review.destroy();
    success(res, null, '已从学习队列中移除');
  } catch (e) {
    error(res, e.message);
  }
});

// 暂停/恢复单词学习
router.post('/:wordId/pause', async (req, res) => {
  try {
    const { wordId } = req.params;
    const review = await WordReview.findOne({
      where: { userId: req.userId, wordId },
    });
    if (!review) return error(res, '该单词不在学习队列中', 404);

    await review.update({ paused: !review.paused });
    success(res, review, review.paused ? '已暂停学习' : '已恢复学习');
  } catch (e) {
    error(res, e.message);
  }
});

// 暂停/恢复整个词根
router.post('/roots/:rootId/pause', async (req, res) => {
  try {
    const { rootId } = req.params;
    const { paused } = req.body;

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const wordRoots = await WordRoot.findAll({ where: { rootId }, attributes: ['wordId'] });
    const wordIds = wordRoots.map((wr) => wr.wordId);

    if (wordIds.length > 0) {
      await WordReview.update(
        { paused: !!paused },
        { where: { userId: req.userId, wordId: { [Op.in]: wordIds } } }
      );
    }

    success(res, null, paused ? '已暂停该词根的学习' : '已恢复该词根的学习');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
