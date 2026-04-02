/**
 * 测试：词根路由 CRUD
 *   - GET    /roots/         获取词根列表（含搜索）
 *   - GET    /roots/default  获取默认词根
 *   - GET    /roots/:id      获取单个词根
 *   - POST   /roots/         创建词根
 *   - PUT    /roots/:id      更新词根
 *   - DELETE /roots/:id      删除词根
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, Root } from '../models/index.js';
import rootsRouter from '../routes/roots.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';

// ─── 构建测试用 app ────────────────────────────────────────────
const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.userId = userId; next(); });
  app.use('/roots', rootsRouter);
  return app;
};

let app;
let userId;
const suffix = () => Date.now() + Math.random().toString(36).slice(2, 5);

beforeAll(async () => {
  await initDB();
  const user = await User.create({ username: `roottest_${suffix()}`, password: 'x' });
  userId = user.id;
  app = buildApp(userId);
  // 确保默认词根已创建
  await ensureDefaultRoot(userId);
});

// ─── GET /roots/ ──────────────────────────────────────────────
describe('GET /roots/', () => {
  it('返回该用户的词根列表', async () => {
    const res = await request(app).get('/roots/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('包含 wordCount 字段', async () => {
    const res = await request(app).get('/roots/');
    expect(res.body.data.every(r => typeof r.wordCount === 'number')).toBe(true);
  });

  it('keyword 搜索过滤结果', async () => {
    // 先创建一个特殊词根
    await Root.create({ name: `grep_unique_${suffix()}`, meaning: '用于搜索测试', userId });
    const res = await request(app).get('/roots/?keyword=grep_unique');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('grep_unique');
  });
});

// ─── GET /roots/default ───────────────────────────────────────
describe('GET /roots/default', () => {
  it('返回默认词根', async () => {
    const res = await request(app).get('/roots/default');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.isDefault).toBe(true);
  });
});

// ─── POST /roots/ ─────────────────────────────────────────────
describe('POST /roots/', () => {
  it('成功创建词根', async () => {
    const res = await request(app)
      .post('/roots/')
      .send({ name: `post_root_${suffix()}`, meaning: '测试含义' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('name');
  });

  it('缺少必填字段返回错误', async () => {
    const res = await request(app)
      .post('/roots/')
      .send({ name: 'no_meaning' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.msg).toBeTruthy();
  });

  it('重复词根名称返回 400', async () => {
    const name = `dup_root_${suffix()}`;
    await request(app).post('/roots/').send({ name, meaning: '初次' });
    const res = await request(app).post('/roots/').send({ name, meaning: '再次' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/已存在/);
  });
});

// ─── GET /roots/:id ───────────────────────────────────────────
describe('GET /roots/:id', () => {
  let rootId;

  beforeAll(async () => {
    const root = await Root.create({ name: `get_root_${suffix()}`, meaning: '查询测试', userId });
    rootId = root.id;
  });

  it('返回正确的词根', async () => {
    const res = await request(app).get(`/roots/${rootId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(rootId);
  });

  it('不存在的 id 返回错误', async () => {
    const res = await request(app).get('/roots/99999999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── PUT /roots/:id ───────────────────────────────────────────
describe('PUT /roots/:id', () => {
  let rootId;

  beforeAll(async () => {
    const root = await Root.create({ name: `put_root_${suffix()}`, meaning: '更新前', userId });
    rootId = root.id;
  });

  it('成功更新词根', async () => {
    const res = await request(app)
      .put(`/roots/${rootId}`)
      .send({ name: `put_root_updated_${suffix()}`, meaning: '更新后' });
    expect(res.status).toBe(200);
    expect(res.body.data.meaning).toBe('更新后');
  });

  it('缺少必填字段返回错误', async () => {
    const res = await request(app)
      .put(`/roots/${rootId}`)
      .send({ name: 'only_name' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('修改其他用户的词根返回错误', async () => {
    // 创建另一个用户的词根
    const otherUser = await User.create({ username: `other_${suffix()}`, password: 'x' });
    const otherRoot = await Root.create({ name: `other_root_${suffix()}`, meaning: '他人', userId: otherUser.id });

    const res = await request(app)
      .put(`/roots/${otherRoot.id}`)
      .send({ name: 'hacked', meaning: 'hacked' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── DELETE /roots/:id ────────────────────────────────────────
describe('DELETE /roots/:id', () => {
  it('成功删除普通词根', async () => {
    const root = await Root.create({ name: `del_root_${suffix()}`, meaning: '删除测试', userId });
    const res = await request(app).delete(`/roots/${root.id}`);
    expect(res.status).toBe(200);
    const found = await Root.findByPk(root.id);
    expect(found).toBeNull();
  });

  it('不能删除默认词根（返回 400）', async () => {
    const defaultRoot = await ensureDefaultRoot(userId);
    const res = await request(app).delete(`/roots/${defaultRoot.id}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/不能删除/);
  });
});
