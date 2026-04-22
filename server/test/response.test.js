/**
 * 测试：server/utils/response.js
 *   - success(res, data, msg)
 *   - error(res, msg, code)
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { success, error } from '../utils/response.js';
import { createApp } from '../app.js';
import { initDB } from '../models/index.js';

// 构造一个最小化的 res mock
const mockRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res); // 支持链式调用
  return res;
};

describe('success()', () => {
  it('默认返回 HTTP 200，data 和 msg 字段正确', () => {
    const res = mockRes();
    success(res, { id: 1 }, '操作成功');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      data: { id: 1 },
      msg: '操作成功',
    });
  });

  it('不传 data 和 msg 时使用默认值', () => {
    const res = mockRes();
    success(res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toBeNull();
    expect(body.msg).toBe('success');
  });
});

describe('error()', () => {
  it('默认返回 HTTP 500 和错误信息', () => {
    const res = mockRes();
    error(res, '服务器内部错误');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      data: null,
      msg: '服务器内部错误',
    });
  });

  it('自定义错误码正确传递', () => {
    const res = mockRes();
    error(res, '未登录', 401);
    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe(401);
    expect(body.msg).toBe('未登录');
    expect(body.data).toBeNull();
  });

  it('不传 msg 时使用默认值', () => {
    const res = mockRes();
    error(res);
    const body = res.json.mock.calls[0][0];
    expect(body.msg).toBe('服务器内部错误');
  });
});

// ================================================================
// SPA fallback — /api/* 未匹配路由返回 JSON 404
// ================================================================

describe('未知 API 路由返回 JSON 404（非 HTML）', () => {
  let app;

  it('初始化 DB + 创建 app', async () => {
    await initDB();
    app = createApp();
    expect(app).toBeTruthy();
  });

  it('GET /api/nonexistent 返回 JSON 404，非 HTML', async () => {
    const res = await request(app).get('/api/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('code', 404);
    expect(res.body.msg).toContain('API 路由不存在');
  });

  it('POST /api/nonexistent 也返回 JSON 404', async () => {
    const res = await request(app).post('/api/unknown-endpoint').send({});
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
