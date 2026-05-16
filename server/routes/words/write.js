import { Router } from 'express';
import {
  sequelize,
  Word,
  Root,
  WordRoot,
  Example,
  WordReview,
  ReviewHistory,
} from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { ensureDefaultRoot } from '../../utils/defaultRoot.js';
import { ensureWordReview } from '../../utils/wordReview.js';

const router = Router();

const isWordNameConflict = (err) =>
  err?.name === 'SequelizeUniqueConstraintError' ||
  String(err?.message || '').includes('idx_words_user_name_unique');

// 添加单词（支持 rootIds 数组或 rootId 单值；不传时自动归入「未分类」词根）
// 若同名单词已存在，则自动追加新的词根关联
router.post('/', async (req, res) => {
  try {
    const { rootId: rawRootId, rootIds: rawRootIds, name, meaning, phonetic, remark } = req.body;
    if (!name || !meaning) return error(res, '单词和含义为必填项');

    let rootIds = [];
    if (Array.isArray(rawRootIds)) rootIds = rawRootIds.map(Number).filter(Boolean);
    if (rawRootId) rootIds.push(Number(rawRootId));
    rootIds = [...new Set(rootIds)];

    if (rootIds.length) {
      const validRoots = await Root.findAll({ where: { id: rootIds, userId: req.userId } });
      if (validRoots.length !== rootIds.length) return error(res, '部分关联的词根不存在');
    } else {
      const defaultRoot = await ensureDefaultRoot(req.userId);
      rootIds = [defaultRoot.id];
    }

    const trimmedName = name.trim().toLowerCase();

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
      const existingRootIds = existingWord.roots.map((r) => r.id);
      const newRootIds = rootIds.filter((id) => !existingRootIds.includes(id));
      if (newRootIds.length === 0) {
        return error(res, '该单词已存在且已关联相同词根，请勿重复添加', 400);
      }

      await sequelize.transaction(async (transaction) => {
        for (const rid of newRootIds) {
          await WordRoot.findOrCreate({
            where: { wordId: existingWord.id, rootId: rid },
            transaction,
          });
        }
        await ensureWordReview(req.userId, existingWord.id, {
          timezone: req.body.tz,
          transaction,
        });
      });

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

    const word = await sequelize.transaction(async (transaction) => {
      const createdWord = await Word.create(
        {
          name: trimmedName,
          meaning: meaning.trim(),
          phonetic: phonetic?.trim(),
          remark: remark?.trim(),
          userId: req.userId,
        },
        { transaction }
      );

      for (const rid of rootIds) {
        await WordRoot.create({ wordId: createdWord.id, rootId: rid }, { transaction });
      }

      await ensureWordReview(req.userId, createdWord.id, {
        timezone: req.body.tz,
        transaction,
      });

      return createdWord;
    });

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
    if (isWordNameConflict(e)) {
      return error(res, '单词已存在，请勿重复添加', 400);
    }
    error(res, e.message);
  }
});

// 编辑单词（支持更新词根关联）
router.put('/:id', async (req, res) => {
  try {
    const updatedWord = await sequelize.transaction(async (transaction) => {
      const word = await Word.findOne({
        where: { id: req.params.id, userId: req.userId },
        transaction,
      });
      if (!word) {
        const notFoundError = new Error('单词不存在');
        notFoundError.code = 404;
        throw notFoundError;
      }

      const { name, meaning, phonetic, remark, rootIds: rawRootIds } = req.body;
      if (!name || !meaning) {
        const validationError = new Error('单词和含义为必填项');
        validationError.code = 400;
        throw validationError;
      }

      const trimmedName = name.trim().toLowerCase();

      const existingWord = await Word.findOne({
        where: { name: trimmedName, userId: req.userId },
        transaction,
      });
      if (existingWord && existingWord.id !== word.id) {
        const duplicateError = new Error('已存在同名单词，请勿重复命名');
        duplicateError.code = 400;
        throw duplicateError;
      }

      await word.update(
        {
          name: trimmedName,
          meaning: meaning.trim(),
          phonetic: phonetic?.trim(),
          remark: remark?.trim(),
        },
        { transaction }
      );

      if (Array.isArray(rawRootIds)) {
        const rootIds = rawRootIds.map(Number).filter(Boolean);
        if (rootIds.length) {
          const validRoots = await Root.findAll({
            where: { id: rootIds, userId: req.userId },
            transaction,
          });
          if (validRoots.length !== rootIds.length) {
            const relationError = new Error('部分关联的词根不存在');
            relationError.code = 400;
            throw relationError;
          }
          await word.setRoots(rootIds, { transaction });
        }
      }

      return Word.findByPk(word.id, {
        transaction,
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
    });
    success(res, updatedWord, '更新成功');
  } catch (e) {
    if (isWordNameConflict(e)) {
      return error(res, '已存在同名单词，请勿重复命名', 400);
    }
    error(res, e.message, e.code || 500);
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

    await sequelize.transaction(async (transaction) => {
      await WordRoot.destroy({
        where: { wordId: word.id, rootId: Number(fromRootId) },
        transaction,
      });
      await WordRoot.findOrCreate({
        where: { wordId: word.id, rootId: Number(toRootId) },
        transaction,
      });
    });

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

    await sequelize.transaction(async (transaction) => {
      await Example.destroy({ where: { wordId: word.id }, transaction });
      await WordRoot.destroy({ where: { wordId: word.id }, transaction });
      await WordReview.destroy({ where: { wordId: word.id, userId: req.userId }, transaction });
      await ReviewHistory.destroy({ where: { wordId: word.id, userId: req.userId }, transaction });
      await word.destroy({ transaction });
    });

    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
