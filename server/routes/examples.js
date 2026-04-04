import { Router } from 'express';
import { Example, Word } from '../models/index.js';
import { success, successList, error } from '../utils/response.js';

const router = Router();

// 辅助函数：检查单词是否属于当前用户
const isWordOwnedByUser = async (wordId, userId) => {
  return Word.findOne({ where: { id: wordId, userId } });
};

// 获取指定单词下的例句列表（支持 limit/offset 分页）
router.get('/', async (req, res) => {
  try {
    const { wordId } = req.query;
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;

    const wordWhere = { userId: req.userId };
    const where = wordId ? { wordId } : {};

    const queryOpts = {
      where,
      include: [
        {
          model: Word,
          as: 'word',
          attributes: ['id', 'name', 'meaning', 'userId'],
          required: true,
          where: wordWhere,
        },
      ],
      order: [['create_time', 'DESC']],
    };
    if (limit > 0) {
      queryOpts.limit = limit;
      queryOpts.offset = offset;
    }

    const [examples, total] = await Promise.all([
      Example.findAll(queryOpts),
      Example.count({
        where,
        include: [{ model: Word, as: 'word', attributes: [], required: true, where: wordWhere }],
      }),
    ]);
    successList(res, examples, total);
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
          attributes: ['id', 'name', 'meaning', 'userId'],
          required: true,
        },
      ],
    });
    if (!example || example.word?.userId !== req.userId) return error(res, '例句不存在');
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
      include: [{ model: Word, as: 'word', attributes: ['id', 'userId'] }],
    });
    if (!example || example.word?.userId !== req.userId) return error(res, '例句不存在');
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
      include: [{ model: Word, as: 'word', attributes: ['id', 'userId'] }],
    });
    if (!example || example.word?.userId !== req.userId) return error(res, '例句不存在');
    await example.destroy();
    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
