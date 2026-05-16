import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
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

/**
 * 超级管理员登录限速：管理员口令是高价值入口，单独使用更严格阈值。
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    error(res, '管理员登录请求过于频繁，请稍后再试', 429);
  },
});

/**
 * AI 接口限速：按登录用户限额，防止上游模型调用被单用户滥用。
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) => {
    error(res, 'AI 请求过于频繁，请稍后再试', 429);
  },
});
