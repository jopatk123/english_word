import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { requestAiJson, validateAiConfig } from '../utils/ai.js';
import { baseAiConfig, validPrompts } from './ai-test-utils.js';

describe('validateAiConfig', () => {
  const validConfig = { ...baseAiConfig, temperature: 0.5 };

  it('有效配置正常返回', () => {
    const result = validateAiConfig(validConfig);
    expect(result.apiKey).toBe('sk-test12345678');
    expect(result.baseUrl).toBe('https://api.openai.com/v1');
    expect(result.model).toBe('gpt-4o');
    expect(result.providerId).toBe('openai');
    expect(result.temperature).toBeCloseTo(0.5);
  });

  it('缺少 apiKey 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, apiKey: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 baseUrl 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, baseUrl: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 model 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, model: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 providerId 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, providerId: '' })).toThrow('AI 配置不完整');
  });

  it('空配置对象时抛出错误', () => {
    expect(() => validateAiConfig({})).toThrow('AI 配置不完整');
  });

  it('无参数时抛出错误', () => {
    expect(() => validateAiConfig()).toThrow('AI 配置不完整');
  });

  it('baseUrl 末尾斜杠被去除', () => {
    const result = validateAiConfig({ ...validConfig, baseUrl: 'https://api.openai.com/v1///' });
    expect(result.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('temperature 无效时默认使用 0.2', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 'bad' });
    expect(result.temperature).toBe(0.2);
  });

  it('temperature 超出范围时默认使用 0.2', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 5 });
    expect(result.temperature).toBe(0.2);
  });

  it('temperature 为 0 时合法', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 0 });
    expect(result.temperature).toBe(0);
  });

  it('anthropic providerId 返回正确的 providerMode', () => {
    const result = validateAiConfig({
      ...validConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
    });
    expect(result.providerMode).toBe('anthropic');
  });

  it('openai-compatible providerType 返回正确的 providerMode', () => {
    const result = validateAiConfig(validConfig);
    expect(result.providerMode).toBe('openai-compatible');
  });

  it('apiKey 超过 300 字符时被截断', () => {
    const longKey = 'a'.repeat(400);
    const result = validateAiConfig({ ...validConfig, apiKey: longKey });
    expect(result.apiKey.length).toBe(300);
  });

  it('model 超过 120 字符时被截断', () => {
    const longModel = 'a'.repeat(200);
    const result = validateAiConfig({ ...validConfig, model: longModel });
    expect(result.model.length).toBe(120);
  });
});

describe('validateAiConfig SSRF 防护', () => {
  const base = {
    apiKey: 'sk-test12345678',
    model: 'gpt-4o',
    providerId: 'openai',
    providerType: 'openai-compatible',
    temperature: 0.2,
  };

  it('公网 HTTPS URL 正常通过', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'https://api.openai.com/v1' })).not.toThrow();
  });

  it('公网 HTTP URL 正常通过', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://api.example.com/v1' })).not.toThrow();
  });

  it('localhost 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://localhost:11434/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('127.0.0.1 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://127.0.0.1:8080/v1' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('192.168.x.x 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://192.168.1.100/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('10.x.x.x 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://10.0.0.1/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('172.16-31 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://172.16.0.1/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('AWS 元数据端点 169.254.169.254 被拒绝', () => {
    expect(() =>
      validateAiConfig({ ...base, baseUrl: 'http://169.254.169.254/latest/meta-data' })
    ).toThrow('不允许指向本地或私有网络');
  });

  it('IPv6 环回地址 ::1 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://[::1]:8080/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('无效 URL 格式被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'not-a-url' })).toThrow('格式无效');
  });

  it('非 http/https 协议被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'ftp://api.example.com/v1' })).toThrow(
      '仅支持 http 或 https 协议'
    );
  });
});

describe('requestAiJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OpenAI compatible: 成功返回 JSON 对象', async () => {
    const responseBody = { choices: [{ message: { content: '{"message":"ok","items":[]}' } }] };
    fetch.mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    });

    const result = await requestAiJson(baseAiConfig, validPrompts);
    expect(result).toEqual({ message: 'ok', items: [] });
  });

  it('OpenAI compatible: 返回 markdown 代码块中的 JSON', async () => {
    const content = '```json\n{"message":"ok","items":[]}\n```';
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });

    const result = await requestAiJson(baseAiConfig, validPrompts);
    expect(result).toMatchObject({ message: 'ok' });
  });

  it('OpenAI compatible: API 返回错误时抛出', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(requestAiJson(baseAiConfig, validPrompts)).rejects.toThrow('Invalid API key');
  });

  it('OpenAI compatible: AI 返回非 JSON 内容时抛出', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '这不是 JSON' } }] }),
    });

    await expect(requestAiJson(baseAiConfig, validPrompts)).rejects.toThrow('无法解析为 JSON');
  });

  it('OpenAI compatible: 内容为空时抛出', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: null } }] }),
    });

    await expect(requestAiJson(baseAiConfig, validPrompts)).rejects.toThrow('未返回有效内容');
  });

  it('Anthropic: 成功调用并返回 JSON', async () => {
    const anthropicConfig = {
      ...baseAiConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"message":"ok","items":[]}' }],
      }),
    });

    const result = await requestAiJson(anthropicConfig, validPrompts);
    expect(result).toMatchObject({ message: 'ok' });
  });

  it('Anthropic: API 返回错误时抛出', async () => {
    const anthropicConfig = {
      ...baseAiConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Anthropic error' } }),
    });

    await expect(requestAiJson(anthropicConfig, validPrompts)).rejects.toThrow('Anthropic error');
  });

  it('配置不完整时抛出（validateAiConfig 校验）', async () => {
    const badConfig = { ...baseAiConfig, apiKey: '' };
    await expect(requestAiJson(badConfig, validPrompts)).rejects.toThrow('AI 配置不完整');
  });

  it('fetch 网络错误时抛出', async () => {
    fetch.mockRejectedValue(new Error('Network Error'));
    await expect(requestAiJson(baseAiConfig, validPrompts)).rejects.toThrow('Network Error');
  });

  it('content 为数组时能正确拼接', async () => {
    const anthropicConfig = {
      ...baseAiConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: '{"message":' },
          { type: 'text', text: '"ok","items":[]}' },
        ],
      }),
    });

    const result = await requestAiJson(anthropicConfig, validPrompts);
    expect(result.message).toBe('ok');
  });
});