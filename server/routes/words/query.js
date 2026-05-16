import { Router } from 'express';
import { Word, Root, WordRoot, Example } from '../../models/index.js';
import { success, successList, error } from '../../utils/response.js';
import { buildKeywordSearch } from '../../utils/search.js';

const router = Router();

// 获取单词列表（可按词根筛选，支持关键字搜索，支持 limit/offset 分页）
router.get('/', async (req, res) => {
  try {
    const { rootId, keyword } = req.query;
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;

    const where = {
      userId: req.userId,
      ...buildKeywordSearch(keyword, ['name', 'meaning']),
    };

    const rootInclude = {
      model: Root,
      as: 'roots',
      through: { attributes: [] },
      attributes: ['id', 'name', 'meaning'],
      where: { userId: req.userId },
      required: true,
    };

    if (rootId) {
      rootInclude.where = { ...rootInclude.where, id: rootId };
    }

    const queryOpts = {
      where,
      include: [rootInclude, { model: Example, as: 'examples', attributes: ['id'] }],
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
            where: { userId: req.userId },
            required: true,
            ...(rootId ? { where: { userId: req.userId, id: rootId } } : {}),
          },
        ],
        distinct: true,
      }),
    ]);

    // 若按 rootId 筛选，查询结果的 roots 只含该词根；补充完整词根列表
    let result;
    if (rootId) {
      const wordIds = words.map((w) => w.id);
      const allRoots = wordIds.length
        ? await WordRoot.findAll({
            where: { wordId: wordIds },
            include: [
              {
                model: Root,
                as: 'root',
                attributes: ['id', 'name', 'meaning'],
                where: { userId: req.userId },
              },
            ],
          })
        : [];
      const rootsByWord = {};
      for (const wr of allRoots) {
        if (!rootsByWord[wr.wordId]) rootsByWord[wr.wordId] = [];
        if (wr.root)
          rootsByWord[wr.wordId].push({
            id: wr.root.id,
            name: wr.root.name,
            meaning: wr.root.meaning,
          });
      }
      result = words.map((w) => ({
        ...w.toJSON(),
        roots:
          rootsByWord[w.id] ||
          w.roots?.map((r) => ({ id: r.id, name: r.name, meaning: r.meaning })) ||
          [],
        exampleCount: w.examples ? w.examples.length : 0,
        examples: undefined,
      }));
    } else {
      result = words.map((w) => ({
        ...w.toJSON(),
        roots: w.roots?.map((r) => ({ id: r.id, name: r.name, meaning: r.meaning })) || [],
        exampleCount: w.examples ? w.examples.length : 0,
        examples: undefined,
      }));
    }
    successList(res, result, total);
  } catch (e) {
    error(res, e.message);
  }
});

// 获取单个单词详情
router.get('/:id', async (req, res) => {
  try {
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
        { model: Example, as: 'examples', attributes: ['id'] },
      ],
    });
    if (!word) return error(res, '单词不存在');
    const result = {
      ...word.toJSON(),
      roots: word.roots?.map((r) => ({ id: r.id, name: r.name, meaning: r.meaning })) || [],
      exampleCount: word.examples ? word.examples.length : 0,
      examples: undefined,
    };
    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
