/**
 * 测试：全局错误处理、CORS 拒绝、trust proxy 配置与写接口入参类型校验
 *
 * 覆盖的安全修复：
 *   - CORS 白名单拒绝返回 JSON 403，不再落到 Express 默认 HTML 错误页
 *   - 未捕获异常返回 JSON 500 通用提示，响应体不包含堆栈与内部错误信息
 *   - 请求体解析失败返回 JSON 400
 *   - trust proxy 配置解析（反向代理下限流按真实客户端 IP 生效）
 *   - 写接口收到非字符串入参时返回 400，而不是 500 + 内部错误信息
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { initDB, User, Word } from '../models/index.js';
import { generateToken } from '../middleware/auth.js';
import { getTrustProxySetting } from '../utils/env.js';

// 模拟一个未被路由 try/catch 捕获的中间件异常，用于验证全局错误处理
vi.mock('../utils/logger.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestLogger: (req, _res, next) => {
      if (req.headers['x-force-error'] === '1') {
        throw new Error('forced middleware failure /server/app.js:1:1');
      }
      next();
    },
  };
});

const ALLOWED_ORIGIN = 'https://allowed.example.test';
const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

let app;
let authHeader;

beforeAll(async () => {
  await initDB();
  process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
  app = createApp();
  const user = await User.create({ username: `errhandle_${suf()}`, password: 'x' });
  authHeader = { Authorization: `Bearer ${generateToken(user)}` };
});

afterAll(() => {
  delete process.env.ALLOWED_ORIGINS;
});

// ================================================================
// CORS
// ================================================================

describe('CORS 白名单', () => {
  it('白名单来源放行并返回 CORS 头', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('非白名单来源返回 JSON 403，且不泄漏堆栈', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      code: 403,
      data: null,
      msg: 'CORS: 来源 https://evil.example.com 不在白名单中',
    });
    expect(res.text).not.toContain('at ');
    expect(res.text).not.toContain('.js:');
  });
});

// ================================================================
// 错误处理
// ================================================================

describe('统一错误处理', () => {
  it('未捕获异常返回 JSON 500 通用提示，不泄漏堆栈', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/health').set('x-force-error', '1');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ code: 500, data: null, msg: '服务器内部错误' });
    expect(res.text).not.toContain('forced middleware failure');
    expect(res.text).not.toContain('app.js');
    // 服务端仍需记录完整错误，便于排查
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('请求体 JSON 解析失败返回 JSON 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('无请求体的 POST 不因 req.body 为 undefined 而 500', async () => {
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(400);
    expect(res.body.msg).toContain('必填');
  });
});

// ================================================================
// trust proxy
// ================================================================

describe('getTrustProxySetting', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('未设置 + 非生产环境 => false（不信任代理，避免伪造 X-Forwarded-For 绕过限流）', () => {
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'test';
    expect(getTrustProxySetting()).toBe(false);
  });

  it('未设置 + 生产环境 => 1（信任一层反向代理）', () => {
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'production';
    expect(getTrustProxySetting()).toBe(1);
  });

  it('TRUST_PROXY=2 => 2', () => {
    process.env.TRUST_PROXY = '2';
    expect(getTrustProxySetting()).toBe(2);
  });

  it('TRUST_PROXY=false / 0 => false', () => {
    process.env.TRUST_PROXY = 'false';
    expect(getTrustProxySetting()).toBe(false);
    process.env.TRUST_PROXY = '0';
    expect(getTrustProxySetting()).toBe(false);
  });

  it('TRUST_PROXY=loopback 透传给 Express', () => {
    process.env.TRUST_PROXY = 'loopback';
    expect(getTrustProxySetting()).toBe('loopback');
  });

  it('createApp 使用该配置（request.ip 依赖 trust proxy fn）', () => {
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'test';
    expect(createApp().get('trust proxy fn')).toBeTypeOf('function');
  });

  it('TRUST_PROXY=true 时按 X-Forwarded-For 区分限流桶（反向代理后不会全站共用一个桶）', async () => {
    process.env.TRUST_PROXY = 'true';
    try {
      const proxyApp = createApp();
      // 登录限流为 15 次/分钟；16 个不同来源 IP 各自独立计数，均不应被限流
      for (let i = 1; i <= 16; i += 1) {
        const res = await request(proxyApp)
          .post('/api/auth/login')
          .set('X-Forwarded-For', `203.0.113.${i}`)
          .send({ username: `nobody_${i}`, password: 'secret123' });
        expect(res.status).not.toBe(429);
      }
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});

// ================================================================
// 写接口入参类型校验
// ================================================================

describe('写接口入参类型校验返回 400', () => {
  const cases = [
    {
      title: '注册：password 为对象',
      send: () =>
        request(app).post('/api/auth/register').send({ username: 'typed_user', password: {} }),
    },
    {
      title: '登录：username 为数字',
      send: () => request(app).post('/api/auth/login').send({ username: 1, password: 'secret123' }),
    },
    {
      title: '管理员登录：password 为对象',
      send: () => request(app).post('/api/admin/login').send({ password: {} }),
    },
    {
      title: '新增单词：name 为对象',
      send: () =>
        request(app)
          .post('/api/words')
          .set(authHeader)
          .send({ name: {}, meaning: '含义', rootIds: [] }),
    },
    {
      title: '新增单词：可选字段 phonetic 为数字',
      send: () =>
        request(app)
          .post('/api/words')
          .set(authHeader)
          .send({ name: `typed_${suf()}`, meaning: '含义', phonetic: 123, rootIds: [] }),
    },
    {
      title: '新增词根：name 为数组',
      send: () =>
        request(app).post('/api/roots').set(authHeader).send({ name: [], meaning: '核心含义' }),
    },
    {
      title: '新增例句：sentence 为数字',
      send: () =>
        request(app)
          .post('/api/examples')
          .set(authHeader)
          .send({ wordId: 1, sentence: 1, translation: '翻译' }),
    },
    {
      title: '学习计时：note 为对象',
      send: () =>
        request(app)
          .post('/api/study-sessions/start')
          .set(authHeader)
          .send({ note: { a: 1 } }),
    },
  ];

  cases.forEach(({ title, send }) => {
    it(title, async () => {
      const res = await send();
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/json/);
      // 不能回传内部错误信息（如 "name.trim is not a function"）
      expect(res.body.msg).not.toMatch(/is not a function|Illegal arguments|TypeError/);
    });
  });
});

// ================================================================
// quiz-choices 干扰项数量下限
// ================================================================

describe('GET /api/review/quiz-choices/:wordId 的 count 参数', () => {
  let wordIds = [];
  let quizAuthHeader;

  beforeAll(async () => {
    const user = await User.create({ username: `quizcount_${suf()}`, password: 'x' });
    quizAuthHeader = { Authorization: `Bearer ${generateToken(user)}` };
    const words = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        Word.create({ name: `quizword_${suf()}_${i}`, meaning: `含义${i}`, userId: user.id })
      )
    );
    wordIds = words.map((w) => w.id);
  });

  it('count=-1 时按最小值 1 处理，不会返回全部单词', async () => {
    const res = await request(app)
      .get(`/api/review/quiz-choices/${wordIds[0]}?count=-1`)
      .set(quizAuthHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.distractors).toHaveLength(1);
  });

  it('count=99 时按最大值 5 处理', async () => {
    const res = await request(app)
      .get(`/api/review/quiz-choices/${wordIds[0]}?count=99`)
      .set(quizAuthHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.distractors.length).toBeLessThanOrEqual(5);
  });
});
