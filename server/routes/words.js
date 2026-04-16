import { Router } from 'express';
import { Word, Root, WordRoot, Example } from '../models/index.js';
import { success, successList, error } from '../utils/response.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';
import { buildKeywordSearch } from '../utils/search.js';

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

    // 若指定了 rootId，限制必须关联该词根
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

// 添加单词（支持 rootIds 数组或 rootId 单值；不传时自动归入「未分类」词根）
// 若同名单词已存在，则自动追加新的词根关联
router.post('/', async (req, res) => {
  try {
    const { rootId: rawRootId, rootIds: rawRootIds, name, meaning, phonetic, remark } = req.body;
    if (!name || !meaning) return error(res, '单词和含义为必填项');

    // 合并 rootId 和 rootIds
    let rootIds = [];
    if (Array.isArray(rawRootIds)) rootIds = rawRootIds.map(Number).filter(Boolean);
    if (rawRootId) rootIds.push(Number(rawRootId));
    rootIds = [...new Set(rootIds)];

    // 验证所有词根是否属于当前用户
    if (rootIds.length) {
      const validRoots = await Root.findAll({ where: { id: rootIds, userId: req.userId } });
      if (validRoots.length !== rootIds.length) return error(res, '部分关联的词根不存在');
    } else {
      const defaultRoot = await ensureDefaultRoot(req.userId);
      rootIds = [defaultRoot.id];
    }

    const trimmedName = name.trim().toLowerCase();

    // 检查该用户是否已有同名单词
    const existingWord = await Word.findOne({
      where: { name: trimmedName, userId: req.userId },
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          where: { userId: req.userId },
          required: true,
        },
      ],
    });

    if (existingWord) {
      // 单词已存在：追加新的词根关联
      const existingRootIds = existingWord.roots.map((r) => r.id);
      const newRootIds = rootIds.filter((id) => !existingRootIds.includes(id));
      if (newRootIds.length === 0) {
        return error(res, '该单词已存在且已关联相同词根，请勿重复添加', 400);
      }
      for (const rid of newRootIds) {
        await WordRoot.findOrCreate({ where: { wordId: existingWord.id, rootId: rid } });
      }
      const updatedWord = await Word.findByPk(existingWord.id, {
        include: [
          {
            model: Root,
            as: 'roots',
            through: { attributes: [] },
            attributes: ['id', 'name', 'meaning'],
            where: { userId: req.userId },
            required: false,
          },
        ],
      });
      return success(res, updatedWord, `单词已存在，已追加 ${newRootIds.length} 个新词根关联`);
    }

    // 创建新单词
    const word = await Word.create({
      name: trimmedName,
      meaning: meaning.trim(),
      phonetic: phonetic?.trim(),
      remark: remark?.trim(),
      userId: req.userId,
    });

    // 创建词根关联
    for (const rid of rootIds) {
      await WordRoot.create({ wordId: word.id, rootId: rid });
    }

    const fullWord = await Word.findByPk(word.id, {
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          attributes: ['id', 'name', 'meaning'],
          where: { userId: req.userId },
          required: false,
        },
      ],
    });
    success(res, fullWord, '添加成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 编辑单词（支持更新词根关联）
router.put('/:id', async (req, res) => {
  try {
    const word = await Word.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!word) return error(res, '单词不存在');

    const { name, meaning, phonetic, remark, rootIds: rawRootIds } = req.body;
    if (!name || !meaning) return error(res, '单词和含义为必填项');

    const trimmedName = name.trim().toLowerCase();

    // 检查同名单词（同一用户下不允许重名）
    const existingWord = await Word.findOne({ where: { name: trimmedName, userId: req.userId } });
    if (existingWord && existingWord.id !== word.id) {
      return error(res, '已存在同名单词，请勿重复命名', 400);
    }

    await word.update({
      name: trimmedName,
      meaning: meaning.trim(),
      phonetic: phonetic?.trim(),
      remark: remark?.trim(),
    });

    // 更新词根关联（如果提供了 rootIds）
    if (Array.isArray(rawRootIds)) {
      const rootIds = rawRootIds.map(Number).filter(Boolean);
      if (rootIds.length) {
        const validRoots = await Root.findAll({ where: { id: rootIds, userId: req.userId } });
        if (validRoots.length !== rootIds.length) return error(res, '部分关联的词根不存在');
        await word.setRoots(rootIds);
      }
    }

    const updatedWord = await Word.findByPk(word.id, {
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          attributes: ['id', 'name', 'meaning'],
          where: { userId: req.userId },
          required: false,
        },
      ],
    });
    success(res, updatedWord, '更新成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 移动单词到另一个词根（从 fromRootId 解除关联，建立 toRootId 关联）
router.put('/:id/move', async (req, res) => {
  try {
    const { fromRootId, toRootId } = req.body;
    if (!fromRootId || !toRootId) return error(res, 'fromRootId 和 toRootId 为必填项');
    if (Number(fromRootId) === Number(toRootId)) return error(res, '来源词根和目标词根不能相同');

    const word = await Word.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!word) return error(res, '单词不存在');

    const fromRoot = await Root.findOne({ where: { id: fromRootId, userId: req.userId } });
    if (!fromRoot) return error(res, '来源词根不存在');

    const toRoot = await Root.findOne({ where: { id: toRootId, userId: req.userId } });
    if (!toRoot) return error(res, '目标词根不存在');

    await WordRoot.destroy({ where: { wordId: word.id, rootId: Number(fromRootId) } });
    await WordRoot.findOrCreate({ where: { wordId: word.id, rootId: Number(toRootId) } });

    success(res, null, '移动成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 删除单词（级联删除例句和关联）
router.delete('/:id', async (req, res) => {
  try {
    const word = await Word.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!word) return error(res, '单词不存在');

    await Example.destroy({ where: { wordId: word.id } });
    await WordRoot.destroy({ where: { wordId: word.id } });
    await word.destroy();

    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
