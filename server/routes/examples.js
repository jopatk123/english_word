import { Router } from 'express';
import { Example, Word, Root } from '../models/index.js';
import { success, error } from '../utils/response.js';

const router = Router();

// 辅助函数：检查单词是否属于当前用户
const isWordOwnedByUser = async (wordId, userId) => {
  const word = await Word.findByPk(wordId, {
    include: [
      { model: Root, as: 'roots', through: { attributes: [] }, where: { userId }, required: true },
    ],
  });
  return word;
};

// 获取指定单词下的例句列表
router.get('/', async (req, res) => {
  try {
    const { wordId } = req.query;
    const where = wordId ? { wordId } : {};
    const examples = await Example.findAll({
      where,
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id', 'name', 'meaning'],
          required: true,
          include: [
            {
              model: Root,
              as: 'roots',
              through: { attributes: [] },
              attributes: ['id'],
              where: { userId: req.userId },
              required: true,
            },
          ],
        },
      ],
      order: [['create_time', 'DESC']],
    });
    success(res, examples);
  } catch (e) {
    error(res, e.message);
  }
});

// 获取单个例句
router.get('/:id', async (req, res) => {
  try {
    const example = await Example.findByPk(req.params.id, {
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id', 'name', 'meaning'],
          required: true,
          include: [
            {
              model: Root,
              as: 'roots',
              through: { attributes: [] },
              attributes: ['id'],
              where: { userId: req.userId },
              required: true,
            },
          ],
        },
      ],
    });
    if (!example) return error(res, '例句不存在');
    success(res, example);
  } catch (e) {
    error(res, e.message);
  }
});

// 添加例句
router.post('/', async (req, res) => {
  try {
    const { wordId, sentence, translation, remark } = req.body;
    if (!wordId || !sentence || !translation) return error(res, '单词ID、例句原文和翻译为必填项');
    const word = await isWordOwnedByUser(wordId, req.userId);
    if (!word) return error(res, '关联的单词不存在');
    const trimmedSentence = sentence.trim();
    const existedExample = await Example.findOne({ where: { wordId, sentence: trimmedSentence } });
    if (existedExample) return error(res, '该单词下已存在相同例句，请勿重复添加', 400);
    const example = await Example.create({
      wordId,
      sentence: trimmedSentence,
      translation: translation.trim(),
      remark: remark?.trim(),
    });
    success(res, example, '添加成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 编辑例句
router.put('/:id', async (req, res) => {
  try {
    const example = await Example.findByPk(req.params.id, {
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id'],
          include: [
            { model: Root, as: 'roots', through: { attributes: [] }, attributes: ['id', 'userId'] },
          ],
        },
      ],
    });
    if (!example || !example.word?.roots?.some((r) => r.userId === req.userId))
      return error(res, '例句不存在');
    const { sentence, translation, remark } = req.body;
    if (!sentence || !translation) return error(res, '例句原文和翻译为必填项');
    const trimmedSentence = sentence.trim();
    const existedExample = await Example.findOne({
      where: { wordId: example.wordId, sentence: trimmedSentence },
    });
    if (existedExample && existedExample.id !== example.id)
      return error(res, '该单词下已存在相同例句，请勿重复保存', 400);
    await example.update({
      sentence: trimmedSentence,
      translation: translation.trim(),
      remark: remark?.trim(),
    });
    success(res, example, '更新成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 删除例句
router.delete('/:id', async (req, res) => {
  try {
    const example = await Example.findByPk(req.params.id, {
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id'],
          include: [
            { model: Root, as: 'roots', through: { attributes: [] }, attributes: ['id', 'userId'] },
          ],
        },
      ],
    });
    if (!example || !example.word?.roots?.some((r) => r.userId === req.userId))
      return error(res, '例句不存在');
    await example.destroy();
    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
