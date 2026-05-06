/**
 * 测试：超级管理员路由
 *   - POST /api/admin/login
 *   - GET  /api/admin/users
 *   - PUT  /api/admin/users/:id/password
 *   - PUT  /api/admin/users/:id/status
 *   - DELETE /api/admin/users/:id
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  initDB,
  User,
  Root,
  Word,
  WordRoot,
  Example,
  WordReview,
  ReviewHistory,
  StudySession,
} from '../models/index.js';
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
// 与 vitest.config.js 中注入的 ADMIN_PASSWORD 保持一致
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'test-admin-password';
const suffix = () => Date.now() + Math.random().toString(36).slice(2, 6);

beforeAll(async () => {
  await initDB();
  app = buildApp();

  const userName = `admin_test_${suffix()}`;
  await request(app)
    .post('/api/auth/register')
    .send({ username: userName, password: 'oldpass123' });
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

describe('DELETE /api/admin/users/:id', () => {
  let deleteTargetUser;
  let deleteTargetRoot;
  let deleteTargetWord;
  let survivorUser;

  beforeAll(async () => {
    deleteTargetUser = await User.create({
      username: `admin_delete_${suffix()}`,
      password: 'deletepass123',
    });
    deleteTargetRoot = await Root.create({
      name: `admin_delete_root_${suffix()}`,
      meaning: '待删除词根',
      userId: deleteTargetUser.id,
    });
    deleteTargetWord = await Word.create({
      name: `admin_delete_word_${suffix()}`,
      meaning: '待删除单词',
      userId: deleteTargetUser.id,
    });
    await WordRoot.create({ wordId: deleteTargetWord.id, rootId: deleteTargetRoot.id });
    await Example.create({
      wordId: deleteTargetWord.id,
      sentence: 'Delete this example.',
      translation: '删除这条例句。',
    });
    await WordReview.create({
      userId: deleteTargetUser.id,
      wordId: deleteTargetWord.id,
      status: 'learning',
      interval: 2,
      easeFactor: 2.5,
      dueDate: '2099-12-31',
      reviewCount: 1,
      successCount: 1,
      perfectStreakCount: 0,
    });
    await ReviewHistory.create({
      userId: deleteTargetUser.id,
      wordId: deleteTargetWord.id,
      quality: 3,
      intervalBefore: 0,
      intervalAfter: 2,
      easeFactorBefore: 2.5,
      easeFactorAfter: 2.5,
      reviewedAt: new Date(),
    });
    await StudySession.create({
      userId: deleteTargetUser.id,
      startedAt: new Date('2026-05-05T10:00:00Z'),
      endedAt: new Date('2026-05-05T10:25:00Z'),
      durationSeconds: 1500,
      note: 'delete-target',
    });

    survivorUser = await User.create({
      username: `admin_survivor_${suffix()}`,
      password: 'survivorpass123',
    });
    const survivorRoot = await Root.create({
      name: `admin_survivor_root_${suffix()}`,
      meaning: '幸存词根',
      userId: survivorUser.id,
    });
    const survivorWord = await Word.create({
      name: `admin_survivor_word_${suffix()}`,
      meaning: '幸存单词',
      userId: survivorUser.id,
    });
    await WordRoot.create({ wordId: survivorWord.id, rootId: survivorRoot.id });
  });

  it('删除用户时会清理所有关联数据且不影响其他用户', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${deleteTargetUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: deleteTargetUser.id });
    expect(res.body.data.deletedCounts).toMatchObject({
      roots: 1,
      words: 1,
      wordRoots: 1,
      examples: 1,
      wordReviews: 1,
      reviewHistories: 1,
      studySessions: 1,
    });

    expect(await User.findByPk(deleteTargetUser.id)).toBeNull();
    expect(await Root.count({ where: { userId: deleteTargetUser.id } })).toBe(0);
    expect(await Word.count({ where: { userId: deleteTargetUser.id } })).toBe(0);
    expect(await WordReview.count({ where: { userId: deleteTargetUser.id } })).toBe(0);
    expect(await ReviewHistory.count({ where: { userId: deleteTargetUser.id } })).toBe(0);
    expect(await StudySession.count({ where: { userId: deleteTargetUser.id } })).toBe(0);
    expect(await WordRoot.count({ where: { rootId: deleteTargetRoot.id } })).toBe(0);
    expect(await WordRoot.count({ where: { wordId: deleteTargetWord.id } })).toBe(0);
    expect(await Example.count({ where: { wordId: deleteTargetWord.id } })).toBe(0);

    expect(await Root.count({ where: { userId: survivorUser.id } })).toBe(1);
    expect(await Word.count({ where: { userId: survivorUser.id } })).toBe(1);

    const deletedLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: deleteTargetUser.username, password: 'deletepass123' });
    expect(deletedLogin.status).toBe(401);
  });
});

// ── getAdminPassword 环境变量行为 ──────────────────────────────

import { getAdminPassword, getDbPath, getServerPort } from '../utils/env.js';

describe('getAdminPassword', () => {
  it('ADMIN_PASSWORD 已配置时返回配置值', () => {
    const original = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'custom-secure-pass';
    expect(getAdminPassword()).toBe('custom-secure-pass');
    process.env.ADMIN_PASSWORD = original;
  });

  it('NODE_ENV=test 时未配置也不抛出（返回测试占位密码）', () => {
    const original = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    // vitest 运行时 NODE_ENV 为 "test"，应返回内置占位密码而非抛出
    expect(() => getAdminPassword()).not.toThrow();
    process.env.ADMIN_PASSWORD = original;
  });
});

describe('getDbPath', () => {
  it('DB_PATH 已配置时返回配置值', () => {
    const original = process.env.DB_PATH;
    process.env.DB_PATH = '/tmp/english-word-test.db';
    expect(getDbPath()).toBe('/tmp/english-word-test.db');
    process.env.DB_PATH = original;
  });

  it('DB_PATH 未配置时抛错', () => {
    const original = process.env.DB_PATH;
    delete process.env.DB_PATH;
    expect(() => getDbPath()).toThrow(/DB_PATH/);
    process.env.DB_PATH = original;
  });
});

describe('getServerPort', () => {
  it('PORT 已配置时返回数值端口', () => {
    const original = process.env.PORT;
    process.env.PORT = '3010';
    expect(getServerPort()).toBe(3010);
    process.env.PORT = original;
  });

  it('PORT 未配置时抛错', () => {
    const original = process.env.PORT;
    delete process.env.PORT;
    expect(() => getServerPort()).toThrow(/PORT/);
    process.env.PORT = original;
  });

  it('PORT 非法时抛错', () => {
    const original = process.env.PORT;
    process.env.PORT = 'abc';
    expect(() => getServerPort()).toThrow(/1-65535/);
    process.env.PORT = original;
  });
});
