import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  adminLoginRateLimiter,
  aiRateLimiter,
  authRateLimiter,
} from '../middleware/rateLimiter.js';

const requestWithIp = (app, path, ip, headers = {}) =>
  request(app).get(path).set('X-Forwarded-For', ip).set(headers);

const buildAuthApp = () => {
  const app = express();
  app.set('trust proxy', true);
  app.use('/auth', authRateLimiter);
  app.get('/auth/check', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

const buildAdminApp = () => {
  const app = express();
  app.set('trust proxy', true);
  app.use('/admin', adminLoginRateLimiter);
  app.get('/admin/login', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

const buildAiApp = () => {
  const app = express();
  app.set('trust proxy', true);
  app.use((req, _res, next) => {
    req.userId = Number(req.headers['x-user-id']) || null;
    next();
  });
  app.use('/ai', aiRateLimiter);
  app.get('/ai/test', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

describe('authRateLimiter', () => {
  it('同一 IP 超过 15 次后返回 429', async () => {
    const app = buildAuthApp();
    const ip = '203.0.113.11';

    for (let index = 0; index < 15; index += 1) {
      const res = await requestWithIp(app, '/auth/check', ip);
      expect(res.status).toBe(200);
    }

    const limitedRes = await requestWithIp(app, '/auth/check', ip);
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.msg).toContain('请求过于频繁');
  });
});

describe('adminLoginRateLimiter', () => {
  it('同一 IP 超过 5 次后返回 429', async () => {
    const app = buildAdminApp();
    const ip = '203.0.113.21';

    for (let index = 0; index < 5; index += 1) {
      const res = await requestWithIp(app, '/admin/login', ip);
      expect(res.status).toBe(200);
    }

    const limitedRes = await requestWithIp(app, '/admin/login', ip);
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.msg).toContain('管理员登录请求过于频繁');
  });
});

describe('aiRateLimiter', () => {
  it('按 userId 限速，不会误伤其他用户', async () => {
    const app = buildAiApp();

    for (let index = 0; index < 30; index += 1) {
      const res = await requestWithIp(app, '/ai/test', '198.51.100.11', { 'X-User-Id': '101' });
      expect(res.status).toBe(200);
    }

    const limitedRes = await requestWithIp(app, '/ai/test', '198.51.100.11', {
      'X-User-Id': '101',
    });
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.msg).toContain('AI 请求过于频繁');

    const otherUserRes = await requestWithIp(app, '/ai/test', '198.51.100.11', {
      'X-User-Id': '202',
    });
    expect(otherUserRes.status).toBe(200);
  });
});
