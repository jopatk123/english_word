import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, Example } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';

const router = Router();

// 获取指定词根下的单词列表
router.get('/', async (req, res) => {
  try {
    const { rootId, keyword } = req.query;
    const where = {};
    if (rootId) where.rootId = rootId;
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };
    const words = await Word.findAll({
      where,
      include: [
        { model: Root, as: 'root', attributes: ['id', 'name', 'meaning'], where: { userId: req.userId }, required: true },
        { model: Example, as: 'examples', attributes: ['id'] },
      ],
      order: [['create_time', 'DESC']],
    });
    const result = words.map(w => ({
      ...w.toJSON(),
      exampleCount: w.examples ? w.examples.length : 0,
      examples: undefined,
    }));
    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

// 获取单个单词详情
router.get('/:id', async (req, res) => {
  try {
    const word = await Word.findByPk(req.params.id, {
      include: [
        { model: Root, as: 'root', attributes: ['id', 'name', 'meaning'], where: { userId: req.userId }, required: true },
        { model: Example, as: 'examples', attributes: ['id'] },
      ],
    });
    if (!word) return error(res, '单词不存在');
    const result = { ...word.toJSON(), exampleCount: word.examples ? word.examples.length : 0, examples: undefined };
    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

// 添加单词（rootId 可选；不传时自动归入「未分类」词根）
router.post('/', async (req, res) => {
  try {
    const { rootId: rawRootId, name, meaning, phonetic, remark } = req.body;
    if (!name || !meaning) return error(res, '单词和含义为必填项');

    let rootId = rawRootId ? Number(rawRootId) : null;
    if (rootId) {
      const root = await Root.findByPk(rootId);
      if (!root || root.userId !== req.userId) return error(res, '关联的词根不存在');
    } else {
      // 无词根：自动使用「未分类」默认词根
      const defaultRoot = await ensureDefaultRoot(req.userId);
      rootId = defaultRoot.id;
    }

    const trimmedName = name.trim();
    const existedWord = await Word.findOne({ where: { rootId, name: trimmedName } });
    if (existedWord) return error(res, '该词根下已存在同名单词，请勿重复添加', 400);
    const word = await Word.create({
      rootId,
      name: trimmedName,
      meaning: meaning.trim(),
      phonetic: phonetic?.trim(),
      remark: remark?.trim(),
    });
    success(res, word, '添加成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 编辑单词
router.put('/:id', async (req, res) => {
  try {
    const word = await Word.findByPk(req.params.id, {
      include: [{ model: Root, as: 'root', attributes: ['id', 'userId'] }],
    });
    if (!word || word.root?.userId !== req.userId) return error(res, '单词不存在');
    const { name, meaning, phonetic, remark } = req.body;
    if (!name || !meaning) return error(res, '单词和含义为必填项');
    const trimmedName = name.trim();
    const existedWord = await Word.findOne({ where: { rootId: word.rootId, name: trimmedName } });
    if (existedWord && existedWord.id !== word.id) return error(res, '该词根下已存在同名单词，请勿重复命名', 400);
    await word.update({
      name: trimmedName,
      meaning: meaning.trim(),
      phonetic: phonetic?.trim(),
      remark: remark?.trim(),
    });
    success(res, word, '更新成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 删除单词（级联删除例句）
router.delete('/:id', async (req, res) => {
  try {
    const word = await Word.findByPk(req.params.id, {
      include: [{ model: Root, as: 'root', attributes: ['id', 'userId'] }],
    });
    if (!word || word.root?.userId !== req.userId) return error(res, '单词不存在');
    await word.destroy();
    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
