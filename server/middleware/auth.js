import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';
import { getJwtSecret } from '../utils/env.js';
import { User } from '../models/index.js';
import { API_TOKEN_PREFIX, validateToken } from '../services/api-tokens.js';

export const AUTH_TYPE_JWT = 'jwt';
export const AUTH_TYPE_API_TOKEN = 'api-token';

export const generateToken = (user) => {
  return jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion || 0 }, getJwtSecret(), {
    expiresIn: '7d',
  });
};

const rejectIfDisabled = (res, user) => {
  if (user.isDisabled) {
    error(res, '账号已被禁用，请联系管理员', 401);
    return true;
  }
  return false;
};

const authenticateApiToken = async (req, res, next, token) => {
  try {
    const user = await validateToken(token);
    if (!user) {
      return error(res, '无效的 API Token', 401);
    }
    if (rejectIfDisabled(res, user)) return;
    req.userId = user.id;
    req.user = user;
    req.authType = AUTH_TYPE_API_TOKEN;
    return next();
  } catch (e) {
    if (e.message?.includes('API_TOKEN_PEPPER')) {
      return error(res, e.message, 500);
    }
    return error(res, '无效的 API Token', 401);
  }
};

const authenticateJwt = async (req, res, next, token) => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return error(res, '登录已过期，请重新登录', 401);
    }
    if (rejectIfDisabled(res, user)) return;
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return error(res, '登录已失效，请重新登录', 401);
    }
    req.userId = user.id;
    req.user = user;
    req.authType = AUTH_TYPE_JWT;
    return next();
  } catch (e) {
    if (e.message?.includes('JWT_SECRET')) {
      return error(res, e.message, 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return error(res, '未登录，请先登录', 401);
  }

  // ewt_ 前缀只走 API Token，失败即 401，不再回落到 JWT。
  if (token.startsWith(API_TOKEN_PREFIX)) {
    return authenticateApiToken(req, res, next, token);
  }

  return authenticateJwt(req, res, next, token);
};

export const jwtAuthMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, (err) => {
    if (err) return next(err);
    if (res.headersSent) return;
    if (req.authType !== AUTH_TYPE_JWT) {
      return error(res, 'API Token 管理需要登录后的 JWT，不能使用 API Token 自身操作', 403);
    }
    return next();
  });
};
