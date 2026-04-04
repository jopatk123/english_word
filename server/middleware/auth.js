import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';
import { getJwtSecret } from '../utils/env.js';

export const generateToken = (userId) => {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });
};

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.userId;
    next();
  } catch (e) {
    if (e.message?.includes('JWT_SECRET')) {
      return error(res, e.message, 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};
