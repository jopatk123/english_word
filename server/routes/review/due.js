import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { Word, Root, Example, WordReview } from '../../models/index.js';
import { success, handleRouteError } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';
import {
  ORDER_BY_OLDEST_REVIEW,
  buildScopeDueWhere,
  collectDuePoolIds,
} from '../../utils/dueFiller.js';

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

const REVIEW_INCLUDE = [
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
      { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation', 'remark'] },
    ],
  },
];

router.get('/due', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const todayStartDate = todayStart(req.query.tz);
    const now = new Date();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 0, 0), 1000);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const requestedScope = String(req.query.scope || 'due');
    const scope = [
      'due',
      'today-due',
      'overdue',
      'today-reviewed',
      'learning',
      'known',
      'known-review',
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
    } else if (scope === 'known' || scope === 'known-review') {
      where.status = REVIEW_STATUS.KNOWN;
    }

    let order;
    if (scope === 'today-reviewed') {
      order = ORDER_BY_LAST_REVIEWED_DESC;
    } else if (scope === 'known-review') {
      // 已掌握复习：优先最久未复习的（lastReviewedAt ASC，NULL 视为最早）
      order = ORDER_BY_OLDEST_REVIEW;
    } else if (scope === 'all' || scope === 'continue') {
      order = ORDER_BY_LEARNING_FIRST;
    } else {
      order = ORDER_BY_DUE_AND_EASE;
    }

    // scope=due 单独处理：真到期在前，其后是补足与防饿死切片，
    // 合并后再统一应用 offset/limit。这两段只对 due 生效。
    if (scope === 'due') {
      const merged = await fetchDueWithFiller({
        userId: req.userId,
        where: buildScopeDueWhere(req.userId, today, now),
        order,
        include: REVIEW_INCLUDE,
        limit,
        offset,
        now,
      });
      return success(
        res,
        merged.filter((r) => r.word)
      );
    }

    // scope=known-review：从已掌握单词中取 10%（最少 1 个，最多 30 个），
    // 优先选取最久未复习的（lastReviewedAt ASC）。
    if (scope === 'known-review') {
      const knownCount = await WordReview.count({ where });
      if (knownCount === 0) return success(res, []);

      const reviewLimit = Math.min(Math.max(Math.ceil(knownCount * 0.1), 1), 30);
      const idRows = await WordReview.findAll({
        where,
        attributes: ['id'],
        order,
        limit: reviewLimit,
      });
      if (idRows.length === 0) return success(res, []);

      const reviews = await WordReview.findAll({
        where: { id: { [Op.in]: idRows.map((r) => r.id) } },
        order,
        include: REVIEW_INCLUDE,
      });
      return success(
        res,
        reviews.filter((r) => r.word)
      );
    }

    const queryOpts = {
      where,
      order,
      include: REVIEW_INCLUDE,
    };

    if (limit > 0) {
      // Two-pass pagination: first get paginated review IDs, then fetch full data for those IDs.
      // Direct LIMIT on a multi-table JOIN inflates row counts (a word with N roots × M examples
      // produces N×M join rows), so LIMIT cuts off in the middle of a word's data.
      const idRows = await WordReview.findAll({
        where,
        attributes: ['id'],
        order,
        limit,
        offset,
      });

      if (idRows.length === 0) {
        return success(res, []);
      }

      const paginatedIds = idRows.map((r) => r.id);
      const reviews = await WordReview.findAll({
        where: { id: { [Op.in]: paginatedIds } },
        order,
        include: REVIEW_INCLUDE,
      });

      return success(
        res,
        reviews.filter((r) => r.word)
      );
    }

    const reviews = await WordReview.findAll(queryOpts);
    const valid = reviews.filter((r) => r.word);
    success(res, valid);
  } catch (e) {
    handleRouteError(res, e);
  }
});

/**
 * scope=due 专用：合并真到期、补足、防饿死后，再统一应用 offset/limit。
 * 顺序始终是真到期 → 补足 → 防饿死。
 */
async function fetchDueWithFiller({ userId, where, order, include, limit, offset, now }) {
  const mergedIds = await collectDuePoolIds({
    userId,
    dueWhere: where,
    dueOrder: order,
    now,
  });

  if (mergedIds.length === 0) return [];

  // 分页保持合并顺序：真到期 → 补足 → 防饿死
  let pagedIds = mergedIds;
  if (offset > 0) {
    pagedIds = pagedIds.slice(offset);
  }
  if (limit > 0) {
    pagedIds = pagedIds.slice(0, limit);
  }

  if (pagedIds.length === 0) return [];

  // 用最终 id 列表拉取完整关联数据，保持合并顺序
  const rows = await WordReview.findAll({
    where: { id: { [Op.in]: pagedIds } },
    include,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return pagedIds.map((id) => byId.get(id)).filter(Boolean);
}

export default router;
