import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { error } from '../utils/response.js';
import { getAdminJwtSecret, getAdminPasswordHash } from '../utils/env.js';
import logger from '../utils/logger.js';
import { API_TOKEN_PREFIX } from '../services/api-tokens.js';

const getAdminCredentialVersion = () =>
  crypto.createHash('sha256').update(getAdminPasswordHash()).digest('hex');

export const generateAdminToken = () => {
  return jwt.sign(
    {
      role: 'admin',
      tokenType: 'admin',
      credentialVersion: getAdminCredentialVersion(),
    },
    getAdminJwtSecret(),
    { expiresIn: '7d' }
  );
};

export const adminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.slice(7).trim();
  if (token.startsWith(API_TOKEN_PREFIX)) {
    return error(res, 'API Token 不能用于超级管理员接口', 401);
  }
  try {
    const decoded = jwt.verify(token, getAdminJwtSecret());
    if (
      decoded.role !== 'admin' ||
      decoded.tokenType !== 'admin' ||
      decoded.credentialVersion !== getAdminCredentialVersion()
    ) {
      return error(res, '无权访问', 401);
    }
    req.adminRole = decoded.role;
    next();
  } catch (e) {
    // 环境变量缺失属于服务端配置问题：只记日志，不回传给未认证请求（避免泄露配置项名称）
    if (e.message?.includes('ADMIN_JWT_SECRET')) {
      logger.error('admin-jwt-config-error', { message: e.message });
      return error(res, '服务器内部错误', 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};
