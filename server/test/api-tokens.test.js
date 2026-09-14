/**
 * 测试：API Token HTTP 契约与鉴权
 *   - JWT 创建 / 列表 / 撤销
 *   - Bearer ewt_ 与用户 JWT 等价访问普通业务 API
 *   - 无效 Bearer fail-closed
 *   - 管理接口拒绝 API Token
 *   - 改密不撤销 API Token；禁用用户 Token 失效
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { initDB, User, ApiToken } from '../models/index.js';
import { createApp } from '../app.js';
import { generateToken } from '../middleware/auth.js';
import { generateAdminToken } from '../middleware/admin.js';
import { createToken } from '../services/api-tokens.js';

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let app;
let user;
let jwtToken;

beforeAll(async () => {
  await initDB();
  app = createApp();
  user = await User.create({
    username: `api_token_http_${suf()}`,
    password: await bcrypt.hash('pass1234', 4),
  });
  jwtToken = generateToken(user);
});

describe('POST/GET/DELETE /api/api-tokens', () => {
  it('JWT 可创建命名 Token，明文只在创建响应出现', async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const created = await request(app)
      .post('/api/api-tokens')
      .set(auth(jwtToken))
      .send({ name: '本地脚本', expiresAt });

    expect(created.status).toBe(200);
    expect(created.body.data.token).toMatch(/^ewt_[0-9a-f]{64}$/);
    expect(created.body.data.tokenPrefix).toBe(created.body.data.token.slice(0, 16));
    expect(created.body.data.name).toBe('本地脚本');
    expect(created.body.msg).toMatch(/不会再显示/);

    const listed = await request(app).get('/api/api-tokens').set(auth(jwtToken));
    expect(listed.status).toBe(200);
    const row = listed.body.data.find((item) => item.id === created.body.data.id);
    expect(row.tokenPrefix).toBe(created.body.data.tokenPrefix);
    expect(row.createdAt).toBeTruthy();
    expect(row).not.toHaveProperty('token');
    expect(JSON.stringify(listed.body)).not.toContain(created.body.data.token);
  });

  it('拒绝无效或过去的过期时间', async () => {
    const invalid = await request(app)
      .post('/api/api-tokens')
      .set(auth(jwtToken))
      .send({ expiresAt: 'not-a-date' });
    expect(invalid.status).toBe(400);

    const past = await request(app)
      .post('/api/api-tokens')
      .set(auth(jwtToken))
      .send({ expiresAt: '2020-01-01T00:00:00Z' });
    expect(past.status).toBe(400);
  });

  it('撤销 Token 后立即失效，且对他人 ID 不泄露存在性', async () => {
    const created = await request(app)
      .post('/api/api-tokens')
      .set(auth(jwtToken))
      .send({ name: '待撤销' });
    const apiToken = created.body.data.token;

    const revoked = await request(app)
      .delete(`/api/api-tokens/${created.body.data.id}`)
      .set(auth(jwtToken));
    expect(revoked.status).toBe(200);

    const useRevoked = await request(app).get('/api/roots').set(auth(apiToken));
    expect(useRevoked.status).toBe(401);

    const missing = await request(app).delete('/api/api-tokens/999999').set(auth(jwtToken));
    expect(missing.status).toBe(200);
  });
});

describe('双路径鉴权与 fail-closed', () => {
  let apiToken;

  beforeAll(async () => {
    const created = await createToken(user.id, { name: '业务访问' });
    apiToken = created.token;
  });

  it('API Token 与用户 JWT 都能访问普通业务 API', async () => {
    const jwtRes = await request(app).get('/api/roots').set(auth(jwtToken));
    const tokenRes = await request(app).get('/api/roots').set(auth(apiToken));
    const meRes = await request(app).get('/api/auth/me').set(auth(apiToken));

    expect(jwtRes.status).toBe(200);
    expect(tokenRes.status).toBe(200);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.id).toBe(user.id);
  });

  it('格式正确但不存在的 ewt_ Bearer 直接 401，不回落到 JWT', async () => {
    const fake = `ewt_${'ab'.repeat(32)}`;
    const res = await request(app).get('/api/roots').set(auth(fake));
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/API Token/);
  });

  it('ewt_ 前缀但格式错误时同样 fail-closed', async () => {
    const res = await request(app).get('/api/roots').set(auth('ewt_not-a-valid-token'));
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/API Token/);
  });

  it('无效 JWT Bearer 走 JWT 路径失败，不会被当成 API Token', async () => {
    const res = await request(app).get('/api/roots').set(auth('thisisnotajwt'));
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/过期|失效|登录/);
  });
});

describe('管理接口与管理员路径隔离', () => {
  it('API Token 不能创建、列出或撤销 Token', async () => {
    const created = await createToken(user.id, { name: '禁用于管理' });
    const header = auth(created.token);

    const createRes = await request(app)
      .post('/api/api-tokens')
      .set(header)
      .send({ name: 'spawn' });
    const listRes = await request(app).get('/api/api-tokens').set(header);
    const revokeRes = await request(app).delete('/api/api-tokens/1').set(header);

    expect(createRes.status).toBe(403);
    expect(listRes.status).toBe(403);
    expect(revokeRes.status).toBe(403);
    expect(createRes.body.msg).toMatch(/JWT/);
  });

  it('API Token 不能作为超级管理员凭证', async () => {
    const created = await createToken(user.id, { name: '不能进后台' });
    const res = await request(app).get('/api/admin/users').set(auth(created.token));
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/超级管理员|未登录|无权/);
  });
});

describe('账号状态与改密', () => {
  it('修改密码 / token_version 递增后 API Token 仍然有效，旧 JWT 失效', async () => {
    const target = await User.create({
      username: `api_token_pwd_${suf()}`,
      password: await bcrypt.hash('oldpass123', 4),
    });
    const oldJwt = generateToken(target);
    const created = await createToken(target.id, { name: '改密后仍可用' });

    await target.update({
      password: await bcrypt.hash('newpass123', 4),
      tokenVersion: (target.tokenVersion || 0) + 1,
    });

    const staleJwt = await request(app).get('/api/roots').set(auth(oldJwt));
    const stillValid = await request(app).get('/api/roots').set(auth(created.token));
    const listed = await request(app)
      .get('/api/api-tokens')
      .set(auth(generateToken(target)));

    expect(staleJwt.status).toBe(401);
    expect(stillValid.status).toBe(200);
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((item) => item.id === created.id)).toBe(true);
  });

  it('禁用用户后其 API Token 被拒绝', async () => {
    const target = await User.create({
      username: `api_token_ban_${suf()}`,
      password: await bcrypt.hash('pass1234', 4),
    });
    const created = await createToken(target.id, { name: '禁用后失效' });
    await target.update({ isDisabled: true });

    const res = await request(app).get('/api/roots').set(auth(created.token));
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/禁用/);
  });

  it('管理员改密接口不会删除 API Token', async () => {
    const target = await User.create({
      username: `api_token_admin_pwd_${suf()}`,
      password: await bcrypt.hash('oldpass123', 4),
    });
    const created = await createToken(target.id, { name: '管理员改密' });
    const adminToken = generateAdminToken();

    const reset = await request(app)
      .put(`/api/admin/users/${target.id}/password`)
      .set(auth(adminToken))
      .send({ password: 'newpass123' });
    expect(reset.status).toBe(200);

    const remaining = await ApiToken.findByPk(created.id);
    expect(remaining).not.toBeNull();
    const stillValid = await request(app).get('/api/roots').set(auth(created.token));
    expect(stillValid.status).toBe(200);
  });
});
