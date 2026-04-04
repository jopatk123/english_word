/**
 * 测试：认证路由 & 中间件
 *   - POST /api/auth/register
 *   - POST /api/auth/login
 *   - GET  /api/auth/me
 *   - authMiddleware（令牌校验）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB } from '../models/index.js';
import authRouter from '../routes/auth.js';
import { authMiddleware } from '../middleware/auth.js';

// ─── 构建测试用 app ────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  // 一个受保护的测试路由，用于验证中间件
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ ok: true, userId: req.userId });
  });
  return app;
};

let app;
const uniqueSuffix = () => Date.now() + Math.random().toString(36).slice(2, 6);

beforeAll(async () => {
  await initDB();
  app = buildApp();
});

// ─── 注册 ─────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('成功注册返回 200 + token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `user_${uniqueSuffix()}`, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('username');
  });

  it('缺少用户名/密码返回 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'only_user' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/必填/);
  });

  it('用户名过短（<2字符）返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/长度/);
  });

  it('密码过短（<6字符）返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `user_${uniqueSuffix()}`, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/长度/);
  });

  it('重复注册同名用户返回 400', async () => {
    const username = `dupuser_${uniqueSuffix()}`;
    await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/已存在/);
  });
});

// ─── 登录 ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  const username = `loginuser_${uniqueSuffix()}`;
  const password = 'loginpass123';

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ username, password });
  });

  it('正确凭证登录成功，返回 token', async () => {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('错误密码返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('不存在的用户名返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_xyz', password: 'pass123' });
    expect(res.status).toBe(401);
  });

  it('缺少参数返回 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username });
    expect(res.status).toBe(400);
  });
});

// ─── /me ──────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const username = `meuser_${uniqueSuffix()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'mepassword' });
    token = regRes.body.data.token;
  });

  it('有效 token 返回用户信息', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('username');
  });

  it('无 token 返回 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── authMiddleware ────────────────────────────────────────────
describe('authMiddleware', () => {
  let token;

  beforeAll(async () => {
    const username = `mwuser_${uniqueSuffix()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'mwpassword' });
    token = regRes.body.data.token;
  });

  it('携带有效 token 可访问受保护路由', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.userId).toBe('number');
  });

  it('不携带 Authorization 头返回 401', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('格式不正确的 Authorization 头返回 401', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'InvalidFormat token');
    expect(res.status).toBe(401);
  });

  it('无效 token 返回 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer thisisaninvalidtoken');
    expect(res.status).toBe(401);
  });
});
