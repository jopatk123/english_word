import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { error } from '../utils/response.js';
import { getAdminJwtSecret, getAdminPasswordHash } from '../utils/env.js';

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

  const token = authHeader.slice(7);
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
    if (e.message?.includes('ADMIN_JWT_SECRET')) {
      return error(res, e.message, 500);
    }
    return error(res, '登录已过期，请重新登录', 401);
  }
};
