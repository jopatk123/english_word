import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, Example, WordReview } from '../models/index.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ========== SRS 算法 ==========
function getNextReview(quality, currentInterval, easeFactor) {
  // quality: 1=again, 2=hard, 3=good, 4=easy
  let newInterval;
  let newEase = easeFactor;

  if (quality === 1) {
    // again — 重新学习
    newInterval = 1;
    newEase = Math.max(1.3, easeFactor - 0.2);
  } else if (quality === 2) {
    // hard
    newInterval = currentInterval < 1 ? 1 : Math.max(1, Math.ceil(currentInterval * 1.2));
    newEase = Math.max(1.3, easeFactor - 0.15);
  } else if (quality === 3) {
    // good
    newInterval = currentInterval < 1 ? 1 : Math.ceil(currentInterval * easeFactor);
    newEase = easeFactor;
  } else {
    // easy
    newInterval = currentInterval < 1 ? 4 : Math.ceil(currentInterval * easeFactor * 1.3);
    newEase = easeFactor + 0.15;
  }

  const status = quality === 1 ? 'learning' : (newInterval >= 21 ? 'known' : 'review');
  return { interval: newInterval, easeFactor: newEase, status };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ========== 获取今日待复习列表 ==========
router.get('/due', async (req, res) => {
  try {
    const today = todayStr();
    const reviews = await WordReview.findAll({
      where: {
        userId: req.userId,
        dueDate: { [Op.lte]: today },
      },
      include: [{
        model: Word,
        as: 'word',
        include: [
          { model: Root, as: 'root', attributes: ['id', 'name', 'meaning'] },
          { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation'] },
        ],
      }],
      order: [['due_date', 'ASC']],
    });

    // 过滤掉单词已被删除的记录
    const valid = reviews.filter(r => r.word);
    success(res, valid);
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 获取学习统计 ==========
router.get('/stats', async (req, res) => {
  try {
    const today = todayStr();

    const [totalCount, dueCount, newCount, learningCount, knownCount, todayReviewed] = await Promise.all([
      WordReview.count({ where: { userId: req.userId } }),
      WordReview.count({ where: { userId: req.userId, dueDate: { [Op.lte]: today } } }),
      WordReview.count({ where: { userId: req.userId, status: 'new' } }),
      WordReview.count({ where: { userId: req.userId, status: 'learning' } }),
      WordReview.count({ where: { userId: req.userId, status: 'known' } }),
      WordReview.count({
        where: {
          userId: req.userId,
          lastReviewedAt: { [Op.gte]: new Date(today + 'T00:00:00') },
        },
      }),
    ]);

    success(res, {
      total: totalCount,
      due: dueCount,
      new: newCount,
      learning: learningCount,
      known: knownCount,
      todayReviewed,
    });
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 将某词根下的单词加入学习队列 ==========
router.post('/enqueue', async (req, res) => {
  try {
    const { rootId } = req.body;
    if (!rootId) return error(res, '请提供词根ID', 400);

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await Word.findAll({ where: { rootId } });
    if (words.length === 0) return error(res, '该词根下没有单词', 400);

    const today = todayStr();
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
          reviewCount: 0,
        },
      });
      if (created) addedCount++;
    }

    success(res, { added: addedCount, total: words.length }, `已添加 ${addedCount} 个新单词到学习队列`);
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 提交复习结果 ==========
router.post('/:wordId/result', async (req, res) => {
  try {
    const { wordId } = req.params;
    const { quality } = req.body; // 1=again, 2=hard, 3=good, 4=easy

    if (![1, 2, 3, 4].includes(quality)) {
      return error(res, 'quality 必须是 1-4 之间的整数', 400);
    }

    const review = await WordReview.findOne({
      where: { userId: req.userId, wordId },
    });
    if (!review) return error(res, '该单词不在学习队列中', 404);

    const { interval, easeFactor, status } = getNextReview(quality, review.interval, review.easeFactor);
    const today = todayStr();
    const nextDue = addDays(today, interval);

    await review.update({
      status,
      interval,
      easeFactor,
      dueDate: nextDue,
      reviewCount: review.reviewCount + 1,
      lastReviewedAt: new Date(),
    });

    success(res, review);
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 获取词根列表及其学习进度 ==========
router.get('/roots-progress', async (req, res) => {
  try {
    const roots = await Root.findAll({
      where: { userId: req.userId },
      include: [{
        model: Word,
        as: 'words',
        attributes: ['id'],
        include: [{
          model: WordReview,
          as: 'reviews',
          where: { userId: req.userId },
          required: false,
          attributes: ['status'],
        }],
      }],
      order: [['create_time', 'DESC']],
    });

    const result = roots.map(r => {
      const wordCount = r.words.length;
      let enrolled = 0, known = 0;
      r.words.forEach(w => {
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

// ========== 重置某单词学习进度 ==========
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

// ========== 从学习队列中移除 ==========
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

export default router;
