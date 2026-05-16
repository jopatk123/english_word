import { rateLimit } from 'express-rate-limit';
import { error } from '../utils/response.js';

/**
 * 认证接口限速：每 IP 每 60 秒最多 15 次请求。
 * 覆盖 /api/auth/login 和 /api/auth/register，防止暴力破解。
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    error(res, '请求过于频繁，请稍后再试', 429);
  },
});
