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
import { initDB, User } from '../models/index.js';
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

  it('重复注册同名用户返回 400，且提示不暴露「用户名已存在」', async () => {
    const username = `dupuser_${uniqueSuffix()}`;
    await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'pass123' });
    expect(res.status).toBe(400);
    // 中性提示：避免注册接口被用来批量枚举已注册账号
    expect(res.body.msg).not.toMatch(/已存在/);
    expect(res.body.msg).toMatch(/不可用/);
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

// ── 账号级登录失败限流 ────────────────────────────────────────
describe('POST /api/auth/login 账号级失败限流', () => {
  const password = 'limitpass123';

  it('同一账号连续失败 10 次后第 11 次返回 429', async () => {
    const username = `limituser_${uniqueSuffix()}`;
    await request(app).post('/api/auth/register').send({ username, password });

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'wrong-pass' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrong-pass' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.msg).toMatch(/过多/);
  });

  it('登录成功不计入失败次数', async () => {
    const username = `okuser_${uniqueSuffix()}`;
    await request(app).post('/api/auth/register').send({ username, password });

    // 成功次数超过 limit(10) 仍应正常登录，说明成功请求不会累加计数
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app).post('/api/auth/login').send({ username, password });
      expect(res.status).toBe(200);
    }
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
  let userId;

  beforeAll(async () => {
    const username = `mwuser_${uniqueSuffix()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'mwpassword' });
    token = regRes.body.data.token;
    userId = regRes.body.data.user.id;
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

  it('tokenVersion 变化后旧 token 失效', async () => {
    const user = await User.findByPk(userId);
    await user.update({ tokenVersion: (user.tokenVersion || 0) + 1 });

    const staleRes = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(staleRes.status).toBe(401);
    expect(staleRes.body.msg).toMatch(/失效|过期/);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'mwpassword' });
    expect(loginRes.status).toBe(200);

    const freshRes = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${loginRes.body.data.token}`);
    expect(freshRes.status).toBe(200);
  });
});
