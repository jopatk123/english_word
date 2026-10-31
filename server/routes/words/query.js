import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { Word, Root, WordRoot, Example, WordReview } from '../../models/index.js';
import { success, successList, error, handleRouteError } from '../../utils/response.js';
import { buildKeywordSearch } from '../../utils/search.js';
import { REVIEW_STATUS } from '../../utils/srs.js';
import {
  WORD_REVIEW_STATUSES,
  buildExampleCountPredicate,
  buildOnlyDefaultRootPredicate,
  applyHasImageFilter,
  pushWhereAnd,
} from '../../utils/vocabFilters.js';
import { parseOptionalBool, parseOptionalInt, clampInt } from '../../utils/queryFlags.js';
import { serializeWord } from '../../utils/wordSerialize.js';

const router = Router();

const buildRootInclude = (userId, rootId) => ({
  model: Root,
  as: 'roots',
  through: { attributes: [] },
  attributes: ['id', 'name', 'meaning'],
  where: rootId ? { userId, id: rootId } : { userId },
  required: true,
});

const buildReviewInclude = (userId, { status, scope }) => {
  const include = {
    model: WordReview,
    as: 'reviews',
    attributes: ['status'],
    where: { userId },
    required: false,
  };
  if (status) {
    include.where = { userId, status };
    include.required = true;
  } else if (scope === 'learning') {
    include.where = { userId, status: { [Op.ne]: REVIEW_STATUS.KNOWN } };
    include.required = true;
  }
  return include;
};

async function loadExampleCounts(wordIds) {
  if (!wordIds.length) return {};
  const rows = await Example.findAll({
    attributes: ['wordId', [fn('COUNT', col('id')), 'exampleCount']],
    where: { wordId: wordIds },
    group: ['wordId'],
    raw: true,
  });
  return Object.fromEntries(
    rows.map((row) => [row.wordId ?? row.word_id, Number(row.exampleCount)])
  );
}

async function fillCompleteRoots(words, userId) {
  const wordIds = words.map((word) => word.id);
  const allRoots = wordIds.length
    ? await WordRoot.findAll({
        where: { wordId: wordIds },
        include: [
          {
            model: Root,
            as: 'root',
            attributes: ['id', 'name', 'meaning'],
            where: { userId },
          },
        ],
      })
    : [];
  const rootsByWord = {};
  for (const wr of allRoots) {
    if (!rootsByWord[wr.wordId]) rootsByWord[wr.wordId] = [];
    if (wr.root) rootsByWord[wr.wordId].push(wr.root);
  }
  return words.map((word) => {
    const clone = word;
    clone.roots = rootsByWord[word.id] || word.roots || [];
    return clone;
  });
}

// 获取单词列表（可按词根、例句数、默认词根、图片、复习状态筛选）
router.get('/', async (req, res) => {
  try {
    const { rootId, keyword, status, scope } = req.query;
    const limit = parseInt(req.query.limit, 10) || 0;
    const offset = parseInt(req.query.offset, 10) || 0;
    const minExamples = parseOptionalInt(req.query.minExamples);
    const maxExamples = parseOptionalInt(req.query.maxExamples);
    const hasImage = parseOptionalBool(req.query.hasImage);
    const onlyDefaultRoot = parseOptionalBool(req.query.onlyDefaultRoot) === true;

    if (status && !WORD_REVIEW_STATUSES.has(status)) {
      return error(res, '无效的 status，仅支持 new/learning/review/known', 400);
    }
    if (scope && scope !== 'learning') {
      return error(res, '无效的 scope，单词列表仅支持 scope=learning', 400);
    }

    const where = {
      userId: req.userId,
      ...buildKeywordSearch(keyword, ['name', 'meaning']),
    };
    applyHasImageFilter(where, hasImage);
    pushWhereAnd(where, buildExampleCountPredicate(minExamples, maxExamples));

    if (onlyDefaultRoot) {
      const defaultRoot = await Root.findOne({
        where: { userId: req.userId, isDefault: true },
        attributes: ['id'],
      });
      if (!defaultRoot) {
        return successList(res, [], 0);
      }
      pushWhereAnd(where, buildOnlyDefaultRootPredicate(defaultRoot.id));
    }

    const rootInclude = buildRootInclude(req.userId, rootId);
    const reviewInclude = buildReviewInclude(req.userId, { status, scope });
    const queryOpts = {
      where,
      include: [rootInclude, reviewInclude],
      order: [['create_time', 'DESC']],
    };
    if (limit > 0) {
      queryOpts.limit = limit;
      queryOpts.offset = offset;
    }

    const [words, total] = await Promise.all([
      Word.findAll(queryOpts),
      Word.count({
        where,
        include: [
          {
            model: Root,
            as: 'roots',
            through: { attributes: [] },
            required: true,
            where: rootInclude.where,
          },
          ...(reviewInclude.required ? [{ ...reviewInclude, attributes: [] }] : []),
        ],
        distinct: true,
      }),
    ]);

    const withRoots = rootId ? await fillCompleteRoots(words, req.userId) : words;
    const exampleCounts = await loadExampleCounts(withRoots.map((word) => word.id));
    const result = withRoots.map((word) =>
      serializeWord(word, { exampleCount: exampleCounts[word.id] || 0 })
    );
    successList(res, result, total);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// 获取单个单词详情
router.get('/:id', async (req, res) => {
  try {
    const includeExamples = parseOptionalBool(req.query.includeExamples) === true;
    const exampleLimit = clampInt(parseOptionalInt(req.query.exampleLimit) || 20, {
      min: 1,
      max: 50,
      fallback: 20,
    });

    const word = await Word.findOne({
      where: { id: req.params.id, userId: req.userId },
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          attributes: ['id', 'name', 'meaning'],
          where: { userId: req.userId },
          required: false,
        },
        {
          model: WordReview,
          as: 'reviews',
          attributes: ['status'],
          where: { userId: req.userId },
          required: false,
        },
      ],
    });
    if (!word) return error(res, '单词不存在');

    const extra = { exampleCount: await Example.count({ where: { wordId: word.id } }) };
    if (includeExamples) {
      extra.examples = await Example.findAll({
        where: { wordId: word.id },
        attributes: ['id', 'sentence', 'translation', 'remark'],
        order: [['create_time', 'DESC']],
        limit: exampleLimit,
      });
    }
    success(res, serializeWord(word, extra));
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
