/**
 * 测试：src/api/index.js
 *   - addAuthHeader 请求拦截器（localStorage token 注入）
 *   - handleError 响应拦截器（401 重定向逻辑）
 *
 * 使用 vi.mock('axios') 捕获 api/index.js 注册的真实拦截器，
 * 再逐一调用验证行为，从而让 api/index.js 的函数体被 v8 覆盖。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── 1. 提前创建共享状态（vi.hoisted 保证在 vi.mock 工厂前初始化）────────
const shared = vi.hoisted(() => ({
  requestHandlers: [],
  responseSuccessHandlers: [],
  responseErrorHandlers: [],
}));

// ── 2. Mock axios — 捕获拦截器注册 ─────────────────────────────────────
vi.mock('axios', () => {
  const makeInstance = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: (fn) => { shared.requestHandlers.push(fn); },
      },
      response: {
        use: (ok, err) => {
          shared.responseSuccessHandlers.push(ok);
          shared.responseErrorHandlers.push(err);
        },
      },
    },
  });

  return {
    default: { create: () => makeInstance() },
  };
});

// ── 3. 导入 api/index.js（触发 axios.create() 和拦截器注册）───────────
import * as apiModule from '../index.js';

// ── localStorage mock ─────────────────────────────────────────────────
const makeLocalStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _reset: () => { store = {}; },
  };
};

const localStorageMock = makeLocalStorageMock();

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock._reset();
  vi.stubGlobal('location', { href: '/' });
});

// ── addAuthHeader 请求拦截器 ──────────────────────────────────────────
describe('addAuthHeader 请求拦截器', () => {
  // api 和 aiApi 各注册一次，使用任意一个即可
  const getHandler = () => shared.requestHandlers[0];

  it('没有 token 时不添加 Authorization 头', () => {
    const config = { headers: {} };
    const result = getHandler()(config);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('有 token 时添加 Authorization Bearer 头', () => {
    localStorageMock.setItem('token', 'test-jwt');
    const config = { headers: {} };
    const result = getHandler()(config);
    expect(result.headers.Authorization).toBe('Bearer test-jwt');
  });

  it('aiApi 实例同样注入 token', () => {
    localStorageMock.setItem('token', 'ai-token');
    const aiHandler = shared.requestHandlers[1];
    const config = { headers: {} };
    const result = aiHandler(config);
    expect(result.headers.Authorization).toBe('Bearer ai-token');
  });
});

// ── handleError 响应拦截器 ────────────────────────────────────────────
describe('handleError 响应拦截器', () => {
  const getErrorHandler = () => shared.responseErrorHandlers[0];

  it('401 + 非认证端点时清除 token 并跳转到 /login', async () => {
    localStorageMock.setItem('token', 'old-token');
    localStorageMock.setItem('user', '{}');
    const err = { response: { status: 401 }, config: { url: '/words' } };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
    expect(localStorageMock.getItem('token')).toBeNull();
    expect(localStorageMock.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('401 + /auth/login 端点不跳转', async () => {
    localStorageMock.setItem('token', 'tok');
    const err = { response: { status: 401 }, config: { url: '/auth/login' } };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
    expect(localStorageMock.getItem('token')).not.toBeNull();
  });

  it('401 + /auth/register 端点不跳转', async () => {
    localStorageMock.setItem('token', 'tok');
    const err = { response: { status: 401 }, config: { url: '/auth/register' } };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
    expect(localStorageMock.getItem('token')).not.toBeNull();
  });

  it('500 错误不触发跳转', async () => {
    localStorageMock.setItem('token', 'tok');
    const err = { response: { status: 500 }, config: { url: '/words' } };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
    expect(localStorageMock.getItem('token')).not.toBeNull();
  });

  it('无 response 的网络错误不跳转', async () => {
    localStorageMock.setItem('token', 'tok');
    const err = { config: { url: '/words' } };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
    expect(localStorageMock.getItem('token')).not.toBeNull();
  });

  it('config.url 缺失时不跳转', async () => {
    const err = { response: { status: 401 }, config: {} };
    await expect(getErrorHandler()(err)).rejects.toBe(err);
  });
});

// ── handleResponse 成功响应拦截器 ────────────────────────────────────
describe('handleResponse 成功拦截器', () => {
  it('返回 response.data', () => {
    const handler = shared.responseSuccessHandlers[0];
    const result = handler({ data: { foo: 'bar' } });
    expect(result).toEqual({ foo: 'bar' });
  });
});

// ── 导出的 API 函数结构 ───────────────────────────────────────────────
describe('导出的 API 函数', () => {
  it('login 是函数', () => { expect(typeof apiModule.login).toBe('function'); });
  it('register 是函数', () => { expect(typeof apiModule.register).toBe('function'); });
  it('getMe 是函数', () => { expect(typeof apiModule.getMe).toBe('function'); });
  it('getRoots 是函数', () => { expect(typeof apiModule.getRoots).toBe('function'); });
  it('getWords 是函数', () => { expect(typeof apiModule.getWords).toBe('function'); });
  it('testAiConnection 是函数', () => { expect(typeof apiModule.testAiConnection).toBe('function'); });
  it('getReviewDue 是函数', () => { expect(typeof apiModule.getReviewDue).toBe('function'); });
  it('exportAllData 是函数', () => { expect(typeof apiModule.exportAllData).toBe('function'); });
});

