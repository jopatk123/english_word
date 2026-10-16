import { Router } from 'express';
import { Op, col, literal } from 'sequelize';

import { Passage, PassageReview } from '../../models/index.js';
import { success, successList, handleRouteError } from '../../utils/response.js';
import { buildKeywordSearch } from '../../utils/search.js';
import { todayStr } from '../../utils/srs.js';
import {
  PASSAGE_MASTERED_STAGE,
  PASSAGE_STATUS,
  derivePassageStatus,
} from '../../services/passage-review.js';
import {
  PASSAGE_LEVELS,
  loadPassageDetail,
  serializeReview,
} from '../../services/passage-store.js';

const router = Router();

const EXCERPT_LENGTH = 160;

/** 在单词边界截断，避免摘要停在单词中间。 */
const buildExcerpt = (raw) => {
  const text = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const sliced = text.slice(0, EXCERPT_LENGTH);
  const boundary = sliced.lastIndexOf(' ');
  const trimmed = boundary > EXCERPT_LENGTH / 2 ? sliced.slice(0, boundary) : sliced;
  return `${trimmed.trimEnd()}…`;
};
const MAX_PAGE_SIZE = 100;

/** 与 derivePassageStatus 保持同一套判定，下推到 SQL 做筛选。 */
const buildStatusWhere = (status, today) => {
  switch (status) {
    case PASSAGE_STATUS.UNREAD:
      return { '$review.id$': null };
    case PASSAGE_STATUS.DUE:
      return { '$review.due_date$': { [Op.lte]: today } };
    case PASSAGE_STATUS.MASTERED:
      return {
        '$review.due_date$': { [Op.gt]: today },
        '$review.stage$': { [Op.gte]: PASSAGE_MASTERED_STAGE },
      };
    case PASSAGE_STATUS.LEARNING:
      return {
        '$review.due_date$': { [Op.gt]: today },
        '$review.stage$': { [Op.lt]: PASSAGE_MASTERED_STAGE },
      };
    default:
      return {};
  }
};

router.get('/', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 20, 1), MAX_PAGE_SIZE);
    const status = Object.values(PASSAGE_STATUS).includes(req.query.status)
      ? req.query.status
      : null;
    const level = PASSAGE_LEVELS.includes(req.query.level) ? req.query.level : null;

    const where = {
      userId: req.userId,
      ...buildKeywordSearch(req.query.keyword, ['title', 'content']),
      ...(level ? { level } : {}),
      ...buildStatusWhere(status, today),
    };

    const { rows, count } = await Passage.findAndCountAll({
      where,
      attributes: [
        'id',
        'title',
        'level',
        'source',
        'topic',
        'wordCount',
        'sentenceCount',
        'create_time',
        'update_time',
        [literal(`substr(\`Passage\`.\`content\`, 1, ${EXCERPT_LENGTH + 80})`), 'excerpt'],
      ],
      include: [
        {
          model: PassageReview,
          as: 'review',
          where: { userId: req.userId },
          required: false,
        },
      ],
      order:
        status === PASSAGE_STATUS.DUE
          ? [[col('review.due_date'), 'ASC']]
          : [['update_time', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      subQuery: false,
    });

    const items = rows.map((passage) => ({
      id: passage.id,
      title: passage.title,
      level: passage.level,
      source: passage.source,
      topic: passage.topic,
      wordCount: passage.wordCount,
      sentenceCount: passage.sentenceCount,
      excerpt: buildExcerpt(passage.get('excerpt')),
      createTime: passage.create_time,
      updateTime: passage.update_time,
      review: serializeReview(passage.review),
      status: derivePassageStatus(passage.review, today),
    }));

    successList(res, items, count);
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get('/due/count', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const count = await PassageReview.count({
      where: { userId: req.userId, dueDate: { [Op.lte]: today } },
    });
    success(res, { count });
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get('/:id', async (req, res) => {
  try {
    success(res, await loadPassageDetail(req.userId, req.params.id, todayStr(req.query.tz)));
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
