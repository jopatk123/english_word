import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';
import { getJwtSecret } from '../utils/env.js';

export const generateAdminToken = () => {
  return jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: '7d' });
};

export const adminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== 'admin') {
      return error(res, '无权访问', 401);
    }
    req.adminRole = decoded.role;
    next();
  } catch (e) {
    if (e.message?.includes('JWT_SECRET')) {
      return error(res, e.message, 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};