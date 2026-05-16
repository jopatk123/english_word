import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { Word, Root, Example, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';

const router = Router();

// SQL expressions for sorting – pushed directly to the DB for efficiency.
const ORDER_BY_DUE_AND_EASE = [
  [literal("COALESCE(due_at, due_date || 'T00:00:00.000Z')"), 'ASC'],
  ['easeFactor', 'ASC'],
];

const ORDER_BY_LAST_REVIEWED_DESC = [['lastReviewedAt', 'DESC']];

const ORDER_BY_LEARNING_FIRST = [
  [literal("CASE WHEN status = 'known' THEN 1 ELSE 0 END"), 'ASC'],
  ...ORDER_BY_DUE_AND_EASE,
];

router.get('/due', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const todayStartDate = todayStart(req.query.tz);
    const now = new Date();
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;
    const requestedScope = String(req.query.scope || 'due');
    const scope = [
      'due',
      'today-due',
      'overdue',
      'today-reviewed',
      'learning',
      'known',
      'all',
      'continue',
    ].includes(requestedScope)
      ? requestedScope
      : 'due';
    const where = {
      userId: req.userId,
    };
    const dueNowForToday = {
      [Op.or]: [{ dueAt: null }, { dueAt: { [Op.lte]: now } }],
    };

    if (scope === 'today-due') {
      where.dueDate = today;
      where[Op.or] = dueNowForToday[Op.or];
    } else if (scope === 'overdue') {
      where.dueDate = { [Op.lt]: today };
    } else if (scope === 'today-reviewed') {
      where.lastReviewedAt = { [Op.gte]: todayStartDate };
    } else if (scope === 'learning') {
      where.status = { [Op.ne]: REVIEW_STATUS.KNOWN };
    } else if (scope === 'known') {
      where.status = REVIEW_STATUS.KNOWN;
    } else if (scope === 'due') {
      where[Op.or] = [{ dueDate: { [Op.lt]: today } }, { dueDate: today, ...dueNowForToday }];
    }

    let order;
    if (scope === 'today-reviewed') {
      order = ORDER_BY_LAST_REVIEWED_DESC;
    } else if (scope === 'all' || scope === 'continue') {
      order = ORDER_BY_LEARNING_FIRST;
    } else {
      order = ORDER_BY_DUE_AND_EASE;
    }

    const queryOpts = {
      where,
      order,
      include: [
        {
          model: Word,
          as: 'word',
          include: [
            {
              model: Root,
              as: 'roots',
              through: { attributes: [] },
              attributes: ['id', 'name', 'meaning'],
            },
            { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation'] },
          ],
        },
      ],
    };

    if (limit > 0) {
      queryOpts.limit = limit;
      queryOpts.offset = offset;
      queryOpts.subQuery = false;
    }

    const reviews = await WordReview.findAll(queryOpts);
    const valid = reviews.filter((r) => r.word);
    success(res, valid);
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
