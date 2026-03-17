import { Router } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { Word, Root, Example, WordReview, ReviewHistory } from '../models/index.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ========== SRS 算法 ==========
const MAX_INTERVAL = 365; // 最大复习间隔（天）

function getNextReview(quality, currentInterval, easeFactor) {
  // quality: 1=again, 2=hard, 3=good, 4=easy
  let newInterval;
  let newEase = easeFactor;
  const isNew = currentInterval < 1; // 新词（从未复习过）

  if (quality === 1) {
    // again — 重新学习，支持当日内多次（10分钟 ≈ 0）
    newInterval = 0;
    newEase = Math.max(1.3, easeFactor - 0.2);
  } else if (quality === 2) {
    // hard
    newInterval = isNew ? 1 : Math.max(1, Math.ceil(currentInterval * 1.2));
    newEase = Math.max(1.3, easeFactor - 0.15);
  } else if (quality === 3) {
    // good — 新词首次给 3 天
    newInterval = isNew ? 3 : Math.ceil(currentInterval * easeFactor);
    newEase = easeFactor;
  } else {
    // easy — 新词首次给 7 天
    newInterval = isNew ? 7 : Math.ceil(currentInterval * easeFactor * 1.3);
    newEase = easeFactor + 0.15;
  }

  // 限制最大间隔
  newInterval = Math.min(newInterval, MAX_INTERVAL);

  const status = quality === 1 ? 'learning' : (newInterval >= 21 ? 'known' : 'review');
  return { interval: newInterval, easeFactor: newEase, status };
}

function todayStr(timezone) {
  if (timezone) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    } catch { /* invalid tz, fallback */ }
  }
  return new Date().toISOString().slice(0, 10);
}

function todayStartUTC(timezone) {
  const today = todayStr(timezone);
  return new Date(today + 'T00:00:00');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ========== 获取今日待复习列表 ==========
router.get('/due', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const limit = parseInt(req.query.limit) || 0; // 0 = 不限制
    const offset = parseInt(req.query.offset) || 0;

    const queryOpts = {
      where: {
        userId: req.userId,
        dueDate: { [Op.lte]: today },
        paused: false,
      },
      include: [{
        model: Word,
        as: 'word',
        include: [
          { model: Root, as: 'root', attributes: ['id', 'name', 'meaning'] },
          { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation'] },
        ],
      }],
      // 排序：超期最久的优先，再按难度系数升序（越难越优先）
      order: [['due_date', 'ASC'], ['ease_factor', 'ASC']],
    };

    if (limit > 0) {
      queryOpts.limit = limit;
      queryOpts.offset = offset;
    }

    const reviews = await WordReview.findAll(queryOpts);

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
    const tz = req.query.tz;
    const today = todayStr(tz);
    const todayStart = todayStartUTC(tz);

    // 计算本周起始（周一）
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
      // 超期：dueDate 严格小于今天（排除暂停）
      WordReview.count({ where: { userId: req.userId, paused: false, dueDate: { [Op.lt]: today } } }),
      // 本周到期
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

// ========== 将某词根下的单词加入学习队列 ==========
router.post('/enqueue', async (req, res) => {
  try {
    const { rootId } = req.body;
    if (!rootId) return error(res, '请提供词根ID', 400);

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await Word.findAll({ where: { rootId } });
    if (words.length === 0) return error(res, '该词根下没有单词', 400);

    const today = todayStr(req.body.tz);
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

    const oldInterval = review.interval;
    const oldEase = review.easeFactor;
    const { interval, easeFactor, status } = getNextReview(quality, review.interval, review.easeFactor);
    const today = todayStr(req.body.tz);
    const nextDue = addDays(today, interval);

    // 记录学习历史
    await ReviewHistory.create({
      userId: req.userId,
      wordId: parseInt(wordId),
      quality,
      intervalBefore: oldInterval,
      intervalAfter: interval,
      easeFactorBefore: oldEase,
      easeFactorAfter: easeFactor,
      reviewedAt: new Date(),
    });

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

// ========== 暂停/恢复单词学习 ==========
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

// ========== 暂停/恢复整个词根 ==========
router.post('/roots/:rootId/pause', async (req, res) => {
  try {
    const { rootId } = req.params;
    const { paused } = req.body; // true=暂停, false=恢复

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await Word.findAll({ where: { rootId }, attributes: ['id'] });
    const wordIds = words.map(w => w.id);

    if (wordIds.length > 0) {
      await WordReview.update(
        { paused: !!paused },
        { where: { userId: req.userId, wordId: { [Op.in]: wordIds } } },
      );
    }

    success(res, null, paused ? '已暂停该词根的学习' : '已恢复该词根的学习');
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 获取选择题干扰项 ==========
router.get('/quiz-choices/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;
    const count = Math.min(parseInt(req.query.count) || 3, 5);

    const word = await Word.findByPk(wordId);
    if (!word) return error(res, '单词不存在', 404);

    // 获取同用户下的其他单词作为干扰项
    const distractors = await Word.findAll({
      where: { id: { [Op.ne]: wordId } },
      attributes: ['id', 'name', 'meaning'],
      order: literal('RANDOM()'),
      limit: count,
    });

    success(res, {
      correct: { id: word.id, name: word.name, meaning: word.meaning },
      distractors: distractors.map(d => ({ id: d.id, name: d.name, meaning: d.meaning })),
    });
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 获取学习历史（用于报表） ==========
router.get('/history', async (req, res) => {
  try {
    const tz = req.query.tz;
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const histories = await ReviewHistory.findAll({
      where: {
        userId: req.userId,
        reviewedAt: { [Op.gte]: since },
      },
      include: [{
        model: Word,
        as: 'word',
        attributes: ['id', 'name'],
      }],
      order: [['reviewed_at', 'DESC']],
    });

    success(res, histories);
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 获取学习历史统计摘要 ==========
router.get('/history/summary', async (req, res) => {
  try {
    const tz = req.query.tz;
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const histories = await ReviewHistory.findAll({
      where: {
        userId: req.userId,
        reviewedAt: { [Op.gte]: since },
      },
      attributes: ['quality', 'reviewedAt'],
      order: [['reviewed_at', 'ASC']],
    });

    // 按天分组
    const dailyMap = {};
    histories.forEach(h => {
      const day = h.reviewedAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, total: 0, again: 0, hard: 0, good: 0, easy: 0 };
      dailyMap[day].total++;
      const qMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      dailyMap[day][qMap[h.quality]]++;
    });

    // 计算连续学习天数（streak）
    const today = todayStr(tz);
    let streak = 0;
    let checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (dailyMap[dateStr]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    success(res, {
      daily: Object.values(dailyMap),
      streak,
      totalReviews: histories.length,
    });
  } catch (e) {
    error(res, e.message);
  }
});

// ========== 导出学习数据 ==========
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';

    const reviews = await WordReview.findAll({
      where: { userId: req.userId },
      include: [{
        model: Word,
        as: 'word',
        attributes: ['name', 'meaning', 'phonetic'],
        include: [{ model: Root, as: 'root', attributes: ['name', 'meaning'] }],
      }],
      order: [['due_date', 'ASC']],
    });

    const data = reviews.filter(r => r.word).map(r => ({
      word: r.word.name,
      meaning: r.word.meaning,
      phonetic: r.word.phonetic || '',
      root: r.word.root?.name || '',
      rootMeaning: r.word.root?.meaning || '',
      status: r.status,
      interval: r.interval,
      easeFactor: r.easeFactor,
      dueDate: r.dueDate,
      reviewCount: r.reviewCount,
      lastReviewedAt: r.lastReviewedAt,
      paused: r.paused,
    }));

    if (format === 'csv') {
      const headers = ['word', 'meaning', 'phonetic', 'root', 'rootMeaning', 'status', 'interval', 'easeFactor', 'dueDate', 'reviewCount', 'lastReviewedAt', 'paused'];
      const csvRows = [headers.join(',')];
      data.forEach(row => {
        csvRows.push(headers.map(h => {
          const val = String(row[h] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(','));
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=learning-data.csv');
      return res.send('\ufeff' + csvRows.join('\n'));
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=learning-data.json');
    res.json({ data, exportedAt: new Date().toISOString(), total: data.length });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
