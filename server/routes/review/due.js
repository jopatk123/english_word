import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { Word, Root, Example, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS, todayStr, todayStart } from '../../utils/srs.js';
import { countLearning, computeMinDueCount } from '../../utils/dueFiller.js';

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

// 补足排序：最近复习时间越早越优先（未复习过的视为最早），相同时间下难度低的优先
// 数据库列名为 last_reviewed_at，COALESCE 把 NULL 视为最早时间统一升序处理
const ORDER_BY_FILLER = [
  [literal("COALESCE(last_reviewed_at, '1970-01-01T00:00:00.000Z')"), 'ASC'],
  ['easeFactor', 'ASC'],
  ['id', 'ASC'],
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
      { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation'] },
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

    // scope=due 单独处理：先查全量 due，按补足规则从 learning 中挑选补足，
    // 合并后再统一应用 offset/limit。补足只对 due 生效，其他 scope 保持原行为。
    if (scope === 'due') {
      const merged = await fetchDueWithFiller({
        userId: req.userId,
        where,
        order,
        include: REVIEW_INCLUDE,
        limit,
        offset,
      });
      return success(res, merged.filter((r) => r.word));
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
    error(res, e.message);
  }
});

/**
 * scope=due 专用：先查全量 due，按补足规则从 learning 中挑选补足单词，
 * 合并后再统一应用 offset/limit。
 *
 * 补足规则：
 * - 若 due 数量已 >= ceil(learningCount / 3)，不补足
 * - 否则从 learning 单词（排除已在 due 中的）里按 lastReviewedAt 升序补足至 ceil(learningCount / 3)
 * - due 在前、补足单词在后
 */
async function fetchDueWithFiller({ userId, where, order, include, limit, offset }) {
  // 1. 查全部 due id（不分页，用于补足判断）
  const dueIdRows = await WordReview.findAll({
    where,
    attributes: ['id'],
    order,
  });
  const dueIds = dueIdRows.map((r) => r.id);

  // 2. 判断补足量
  const learningCount = await countLearning(userId);
  const minDueCount = computeMinDueCount(learningCount);
  const need = Math.max(0, minDueCount - dueIds.length);

  let mergedIds = dueIds;

  if (need > 0) {
    const fillerIdRows = await WordReview.findAll({
      where: {
        userId,
        status: { [Op.ne]: REVIEW_STATUS.KNOWN },
        ...(dueIds.length > 0 ? { id: { [Op.notIn]: dueIds } } : {}),
      },
      attributes: ['id'],
      order: ORDER_BY_FILLER,
      limit: need,
    });
    mergedIds = [...dueIds, ...fillerIdRows.map((r) => r.id)];
  }

  if (mergedIds.length === 0) return [];

  // 3. 应用 offset/limit（保持 due 在前、补足在后）
  let pagedIds = mergedIds;
  if (offset > 0) {
    pagedIds = pagedIds.slice(offset);
  }
  if (limit > 0) {
    pagedIds = pagedIds.slice(0, limit);
  }

  if (pagedIds.length === 0) return [];

  // 4. 用最终 id 列表拉取完整关联数据，保持合并顺序
  const rows = await WordReview.findAll({
    where: { id: { [Op.in]: pagedIds } },
    include,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return pagedIds.map((id) => byId.get(id)).filter(Boolean);
}

export default router;
