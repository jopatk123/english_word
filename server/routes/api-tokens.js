import { Router } from 'express';
import { success, error, handleRouteError } from '../utils/response.js';
import { ApiTokenError, createToken, listUserTokens, revokeToken } from '../services/api-tokens.js';

const router = Router();

const parseExpiresAt = (expiresAt) => {
  if (expiresAt == null || expiresAt === '') return null;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiTokenError('过期时间格式无效');
  }
  if (parsed <= new Date()) {
    throw new ApiTokenError('过期时间必须是未来时间');
  }
  return parsed;
};

const handleApiTokenError = (res, e, fallbackMsg) => {
  if (e instanceof ApiTokenError) {
    return error(res, e.message, e.statusCode);
  }
  return handleRouteError(res, e, fallbackMsg);
};

router.post('/', async (req, res) => {
  try {
    const { name, expiresAt } = req.body || {};
    const result = await createToken(req.userId, {
      name,
      expiresAt: parseExpiresAt(expiresAt),
    });
    success(res, result, 'API Token 已创建，请立即保存明文，之后不会再显示');
  } catch (e) {
    handleApiTokenError(res, e, '创建 API Token 失败');
  }
});

router.get('/', async (req, res) => {
  try {
    const tokens = await listUserTokens(req.userId);
    success(res, tokens);
  } catch (e) {
    handleApiTokenError(res, e, '获取 API Token 列表失败');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await revokeToken(req.params.id, req.userId);
    success(res, null, 'API Token 已撤销');
  } catch (e) {
    handleApiTokenError(res, e, '撤销 API Token 失败');
  }
});

export default router;
