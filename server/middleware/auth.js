import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';
import { getJwtSecret } from '../utils/env.js';
import { User } from '../models/index.js';

export const generateToken = (user) => {
  return jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion || 0 }, getJwtSecret(), {
    expiresIn: '7d',
  });
};

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return error(res, '登录已过期，请重新登录', 401);
    }
    if (user.isDisabled) {
      return error(res, '账号已被禁用，请联系管理员', 401);
    }
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return error(res, '登录已失效，请重新登录', 401);
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch (e) {
    if (e.message?.includes('JWT_SECRET')) {
      return error(res, e.message, 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};
