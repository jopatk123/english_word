import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, Example, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';

const router = Router();

function compareByDueAndEase(a, b) {
  const dueCompare = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  if (dueCompare !== 0) return dueCompare;
  return (a.easeFactor || 0) - (b.easeFactor || 0);
}

function compareByLastReviewedDesc(a, b) {
  const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
  const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
  return bTime - aTime;
}

function compareLearningFirst(a, b) {
  const aRank = a.status === REVIEW_STATUS.KNOWN ? 1 : 0;
  const bRank = b.status === REVIEW_STATUS.KNOWN ? 1 : 0;
  if (aRank !== bRank) return aRank - bRank;
  return compareByDueAndEase(a, b);
}

router.get('/due', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const todayStartDate = todayStart(req.query.tz);
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
      paused: false,
    };

    if (scope === 'today-due') {
      where.dueDate = today;
    } else if (scope === 'overdue') {
      where.dueDate = { [Op.lt]: today };
    } else if (scope === 'today-reviewed') {
      where.lastReviewedAt = { [Op.gte]: todayStartDate };
    } else if (scope === 'learning') {
      where.status = { [Op.ne]: REVIEW_STATUS.KNOWN };
    } else if (scope === 'known') {
      where.status = REVIEW_STATUS.KNOWN;
    } else if (scope === 'due') {
      where.dueDate = { [Op.lte]: today };
    }

    const queryOpts = {
      where,
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

    const reviews = await WordReview.findAll(queryOpts);
    const valid = reviews.filter((r) => r.word);

    if (scope === 'today-reviewed') {
      valid.sort(compareByLastReviewedDesc);
    } else if (scope === 'all' || scope === 'continue') {
      valid.sort(compareLearningFirst);
    } else {
      valid.sort(compareByDueAndEase);
    }

    const sliced = limit > 0 ? valid.slice(offset, offset + limit) : valid;
    success(res, sliced);
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
