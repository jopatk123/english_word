import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, WordReview, ReviewHistory } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { todayStr } from '../../utils/srs.js';

const router = Router();

// 获取学习历史（用于报表）
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const histories = await ReviewHistory.findAll({
      where: {
        userId: req.userId,
        reviewedAt: { [Op.gte]: since },
      },
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id', 'name'],
        },
      ],
      order: [['reviewed_at', 'DESC']],
    });

    success(res, histories);
  } catch (e) {
    error(res, e.message);
  }
});

// 获取学习历史统计摘要
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

    // 使用用户时区对日期进行分组，避免 UTC 偏移导致日期错位
    const toLocalDate = (date) => {
      if (tz) {
        try {
          return new Date(date).toLocaleDateString('en-CA', { timeZone: tz });
        } catch {
          /* invalid tz, fallback */
        }
      }
      return new Date(date).toISOString().slice(0, 10);
    };

    const dailyMap = {};
    histories.forEach((h) => {
      const day = toLocalDate(h.reviewedAt);
      if (!dailyMap[day])
        dailyMap[day] = { date: day, total: 0, again: 0, hard: 0, good: 0, easy: 0 };
      dailyMap[day].total++;
      const qMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      dailyMap[day][qMap[h.quality]]++;
    });

    const today = todayStr(tz);
    let streak = 0;
    let checkDate = today;
    while (dailyMap[checkDate]) {
      streak++;
      // 用纯字符串日期运算，避免 Date 对象的时区陷阱
      const d = new Date(checkDate + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      checkDate = d.toISOString().slice(0, 10);
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

// 导出学习数据
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';

    const reviews = await WordReview.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['name', 'meaning', 'phonetic'],
          include: [
            {
              model: Root,
              as: 'roots',
              through: { attributes: [] },
              attributes: ['name', 'meaning'],
            },
          ],
        },
      ],
      order: [['due_date', 'ASC']],
    });

    const data = reviews
      .filter((r) => r.word)
      .map((r) => ({
        word: r.word.name,
        meaning: r.word.meaning,
        phonetic: r.word.phonetic || '',
        roots: r.word.roots?.map((root) => root.name).join(', ') || '',
        rootMeanings: r.word.roots?.map((root) => root.meaning).join(', ') || '',
        status: r.status,
        interval: r.interval,
        easeFactor: r.easeFactor,
        dueDate: r.dueDate,
        dueAt: r.dueAt,
        reviewCount: r.reviewCount,
        successCount: r.successCount,
        lastReviewedAt: r.lastReviewedAt,
        paused: r.paused,
      }));

    if (format === 'csv') {
      const headers = [
        'word',
        'meaning',
        'phonetic',
        'roots',
        'rootMeanings',
        'status',
        'interval',
        'easeFactor',
        'dueDate',
        'dueAt',
        'reviewCount',
        'successCount',
        'lastReviewedAt',
        'paused',
      ];
      const csvRows = [headers.join(',')];
      data.forEach((row) => {
        csvRows.push(
          headers
            .map((h) => {
              const val = String(row[h] ?? '');
              return val.includes(',') || val.includes('"') || val.includes('\n')
                ? `"${val.replace(/"/g, '""')}"`
                : val;
            })
            .join(',')
        );
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=learning-data.csv');
      return res.send('\ufeff' + csvRows.join('\n'));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=learning-data.json');
    res.json({ data, exportedAt: new Date().toISOString(), total: data.length });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
