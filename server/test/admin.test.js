/**
 * 测试：超级管理员路由
 *   - POST /api/admin/login
 *   - GET  /api/admin/users
 *   - PUT  /api/admin/users/:id/password
 *   - PUT  /api/admin/users/:id/status
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User } from '../models/index.js';
import authRouter from '../routes/auth.js';
import adminRouter from '../routes/admin.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  return app;
};

let app;
let adminToken;
let targetUser;
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'asd123123123';
const suffix = () => Date.now() + Math.random().toString(36).slice(2, 6);

beforeAll(async () => {
  await initDB();
  app = buildApp();

  const userName = `admin_test_${suffix()}`;
  await request(app).post('/api/auth/register').send({ username: userName, password: 'oldpass123' });
  targetUser = await User.findOne({ where: { username: userName } });

  const adminRes = await request(app).post('/api/admin/login').send({ password: adminPassword });
  adminToken = adminRes.body.data.token;
});

describe('POST /api/admin/login', () => {
  it('管理员密码正确时返回 token', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: adminPassword });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('密码错误时返回 401', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/users', () => {
  it('返回分页用户列表和 total', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 1 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.data[0]).toHaveProperty('username');
    expect(res.body.data[0]).toHaveProperty('isDisabled');
  });

  it('无管理员 token 返回 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/users/:id/password', () => {
  it('修改密码后新密码可登录，旧密码不可用', async () => {
    const newPassword = 'newpass123';
    const res = await request(app)
      .put(`/api/admin/users/${targetUser.id}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: newPassword });

    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: targetUser.username, password: 'oldpass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: targetUser.username, password: newPassword });
    expect(newLogin.status).toBe(200);
  });
});

describe('PUT /api/admin/users/:id/status', () => {
  it('禁用后用户无法登录，启用后恢复登录', async () => {
    const disableRes = await request(app)
      .put(`/api/admin/users/${targetUser.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ disabled: true });

    expect(disableRes.status).toBe(200);

    const disabledUser = await User.findByPk(targetUser.id);
    expect(disabledUser.isDisabled).toBe(true);

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: targetUser.username, password: 'newpass123' });
    expect(blockedLogin.status).toBe(401);

    const enableRes = await request(app)
      .put(`/api/admin/users/${targetUser.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ disabled: false });

    expect(enableRes.status).toBe(200);

    const enabledUser = await User.findByPk(targetUser.id);
    expect(enabledUser.isDisabled).toBe(false);

    const restoredLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: targetUser.username, password: 'newpass123' });
    expect(restoredLogin.status).toBe(200);
  });
});