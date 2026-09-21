import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import {
  sequelize,
  User,
  Root,
  Word,
  WordRoot,
  Example,
  WordReview,
  ReviewHistory,
  StudySession,
  UserAiSetting,
  ApiToken,
  WordLookup,
} from '../models/index.js';
import { success, successList, error, handleRouteError } from '../utils/response.js';
import { getAdminPasswordHash } from '../utils/env.js';
import { isString } from '../utils/validation.js';
import { removeUserWordImages } from '../services/word-image-store.js';
import logger from '../utils/logger.js';
import { adminAuthMiddleware, generateAdminToken } from '../middleware/admin.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', adminLoginRateLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return error(res, '密码为必填项', 400);
    if (!isString(password)) return error(res, '密码必须为字符串', 400);

    const passwordMatches = await bcrypt.compare(password, getAdminPasswordHash());
    if (!passwordMatches) {
      return error(res, '管理员密码错误', 401);
    }

    const token = generateAdminToken();
    success(res, { token }, '登录成功');
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const offset = (page - 1) * pageSize;
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';

    const where = keyword
      ? {
          username: {
            [Op.like]: `%${keyword}%`,
          },
        }
      : {};

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [['create_time', 'DESC']],
      limit: pageSize,
      offset,
      attributes: ['id', 'username', 'isDisabled', 'create_time', 'update_time'],
    });

    successList(res, rows, count);
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put('/users/:id/password', adminAuthMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return error(res, '密码为必填项', 400);
    if (!isString(password)) return error(res, '密码必须为字符串', 400);
    if (password.length < 6 || password.length > 100) {
      return error(res, '密码长度需在 6-100 个字符之间', 400);
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, '用户不存在', 404);

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({
      password: hashedPassword,
      tokenVersion: (user.tokenVersion || 0) + 1,
    });
    success(res, null, '密码已更新');
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put('/users/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { disabled } = req.body;
    if (typeof disabled !== 'boolean') {
      return error(res, 'disabled 参数必须为布尔值', 400);
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, '用户不存在', 404);

    await user.update({ isDisabled: disabled });
    success(
      res,
      { id: user.id, isDisabled: user.isDisabled },
      disabled ? '已禁用登录' : '已启用登录'
    );
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.delete('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return error(res, '用户 ID 无效', 400);
    }

    const deletedCounts = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, { transaction });
      if (!user) return null;

      const rootRows = await Root.findAll({
        where: { userId: user.id },
        attributes: ['id'],
        transaction,
      });
      const wordRows = await Word.findAll({
        where: { userId: user.id },
        attributes: ['id'],
        transaction,
      });

      const rootIds = rootRows.map((row) => row.id);
      const wordIds = wordRows.map((row) => row.id);

      const counts = {
        roots: 0,
        words: 0,
        wordRoots: 0,
        examples: 0,
        wordReviews: 0,
        reviewHistories: 0,
        studySessions: 0,
        aiSettings: 0,
        apiTokens: 0,
        wordLookups: 0,
      };

      if (rootIds.length) {
        counts.wordRoots += await WordRoot.destroy({
          where: { rootId: { [Op.in]: rootIds } },
          transaction,
        });
      }

      if (wordIds.length) {
        counts.wordRoots += await WordRoot.destroy({
          where: { wordId: { [Op.in]: wordIds } },
          transaction,
        });
        counts.examples += await Example.destroy({
          where: { wordId: { [Op.in]: wordIds } },
          transaction,
        });
      }

      counts.wordReviews += await WordReview.destroy({ where: { userId: user.id }, transaction });
      counts.reviewHistories += await ReviewHistory.destroy({
        where: { userId: user.id },
        transaction,
      });
      counts.studySessions += await StudySession.destroy({
        where: { userId: user.id },
        transaction,
      });
      counts.aiSettings += await UserAiSetting.destroy({
        where: { userId: user.id },
        transaction,
      });
      counts.apiTokens += await ApiToken.destroy({
        where: { userId: user.id },
        transaction,
      });
      counts.wordLookups += await WordLookup.destroy({
        where: { userId: user.id },
        transaction,
      });

      if (wordIds.length) {
        counts.words += await Word.destroy({
          where: { id: { [Op.in]: wordIds } },
          transaction,
        });
      }

      if (rootIds.length) {
        counts.roots += await Root.destroy({
          where: { id: { [Op.in]: rootIds } },
          transaction,
        });
      }

      await user.destroy({ transaction });
      return counts;
    });

    if (!deletedCounts) {
      return error(res, '用户不存在', 404);
    }

    await removeUserWordImages(userId).catch((cleanupErr) => {
      logger.warn('word-image-user-cleanup-failed', {
        userId,
        message: cleanupErr.message,
      });
    });

    success(res, { id: userId, deletedCounts }, '用户及关联数据已删除');
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
