import { Router } from 'express';
import { Op, literal } from 'sequelize';

import { Passage, PassageReview } from '../../models/index.js';
import { success, successList, handleRouteError } from '../../utils/response.js';
import { buildKeywordSearch } from '../../utils/search.js';
import { todayStr } from '../../utils/srs.js';
import { PASSAGE_STATUS, derivePassageStatus } from '../../services/passage-review.js';
import { buildPassageListOrder, buildStatusWhere } from '../../services/passage-query.js';
import {
  PASSAGE_LEVELS,
  isPassageArchived,
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
        'archived',
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
      order: buildPassageListOrder(today),
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
      archived: isPassageArchived(passage),
      excerpt: buildExcerpt(passage.get('excerpt')),
      createTime: passage.create_time,
      updateTime: passage.update_time,
      review: serializeReview(passage.review),
      status: derivePassageStatus(passage.review, today, isPassageArchived(passage)),
    }));

    successList(res, items, count);
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get('/due/count', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const count = await Passage.count({
      where: { userId: req.userId, archived: false },
      include: [
        {
          model: PassageReview,
          as: 'review',
          required: true,
          where: { userId: req.userId, dueDate: { [Op.lte]: today } },
        },
      ],
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
