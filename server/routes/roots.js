import { Router } from 'express';
import { Op } from 'sequelize';
import { Root, Word } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';

const router = Router();

// 获取（或自动创建）当前用户的「未分类」默认词根
// 注意：必须在 /:id 路由之前定义，否则会被当成 id
router.get('/default', async (req, res) => {
  try {
    const root = await ensureDefaultRoot(req.userId);
    success(res, {
      id: root.id,
      name: root.name,
      meaning: root.meaning,
      isDefault: true,
    });
  } catch (e) {
    error(res, e.message);
  }
});

// 获取词根列表（支持模糊搜索）
router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    const where = { userId: req.userId };
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };
    const roots = await Root.findAll({
      where,
      include: [{ model: Word, as: 'words', attributes: ['id'] }],
      // 默认词根排在最后，其余按创建时间倒序
      order: [['is_default', 'ASC'], ['create_time', 'DESC']],
    });
    const result = roots.map(r => {
      const json = r.toJSON();
      delete json.userId;
      delete json.user_id;
      return { ...json, wordCount: r.words ? r.words.length : 0, words: undefined, isDefault: r.isDefault };
    });
    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

// 获取单个词根详情
router.get('/:id', async (req, res) => {
  try {
    const root = await Root.findByPk(req.params.id, {
      include: [{ model: Word, as: 'words', attributes: ['id'] }],
    });
    if (!root || root.userId !== req.userId) return error(res, '词根不存在');
    const json = root.toJSON();
    delete json.userId;
    delete json.user_id;
    const result = { ...json, wordCount: root.words ? root.words.length : 0, words: undefined, isDefault: root.isDefault };
    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

// 添加词根
router.post('/', async (req, res) => {
  try {
    const { name, meaning, remark } = req.body;
    if (!name || !meaning) return error(res, '词根和核心含义为必填项');
    const trimmedName = name.trim();
    const existedRoot = await Root.findOne({ where: { name: trimmedName, userId: req.userId } });
    if (existedRoot) return error(res, '词根已存在，请勿重复添加', 400);
    const root = await Root.create({ name: trimmedName, meaning: meaning.trim(), remark: remark?.trim(), userId: req.userId });
    success(res, root, '添加成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 编辑词根
router.put('/:id', async (req, res) => {
  try {
    const root = await Root.findByPk(req.params.id);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在');
    const { name, meaning, remark } = req.body;
    if (!name || !meaning) return error(res, '词根和核心含义为必填项');
    const trimmedName = name.trim();
    const existedRoot = await Root.findOne({ where: { name: trimmedName, userId: req.userId } });
    if (existedRoot && existedRoot.id !== root.id) return error(res, '词根已存在，请勿重复命名', 400);
    await root.update({ name: trimmedName, meaning: meaning.trim(), remark: remark?.trim() });
    success(res, root, '更新成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 删除词根（级联删除）
router.delete('/:id', async (req, res) => {
  try {
    const root = await Root.findByPk(req.params.id);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在');
    if (root.isDefault) return error(res, '「未分类」词根不能删除，它用于存放无词根的单词', 400);
    await root.destroy();
    success(res, null, '删除成功');
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
