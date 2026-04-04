/**
 * 测试：client/src/constants/aiProviders.js
 *   - AI_PROVIDERS 数据结构验证
 *   - DEFAULT_PROVIDER_ID 常量
 *   - getProviderById 查找函数
 */
import { describe, it, expect } from 'vitest';
import { AI_PROVIDERS, DEFAULT_PROVIDER_ID, getProviderById } from '../aiProviders.js';

describe('AI_PROVIDERS', () => {
  it('是非空数组', () => {
    expect(Array.isArray(AI_PROVIDERS)).toBe(true);
    expect(AI_PROVIDERS.length).toBeGreaterThan(0);
  });

  it('每个 provider 都有 id / name / providerType / baseUrl / models 字段', () => {
    for (const p of AI_PROVIDERS) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('providerType');
      expect(p).toHaveProperty('baseUrl');
      expect(Array.isArray(p.models)).toBe(true);
    }
  });

  it('providerType 只允许指定枚举值', () => {
    const validTypes = new Set(['openai-compatible', 'anthropic']);
    for (const p of AI_PROVIDERS) {
      expect(validTypes.has(p.providerType)).toBe(true);
    }
  });

  it('所有 id 唯一', () => {
    const ids = AI_PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('包含 deepseek 厂商', () => {
    expect(AI_PROVIDERS.some(p => p.id === 'deepseek')).toBe(true);
  });

  it('包含 anthropic 厂商', () => {
    expect(AI_PROVIDERS.some(p => p.id === 'anthropic')).toBe(true);
  });

  it('每个 provider 至少有一个 model', () => {
    for (const p of AI_PROVIDERS) {
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it('baseUrl 以 http 开头', () => {
    for (const p of AI_PROVIDERS) {
      expect(p.baseUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe('DEFAULT_PROVIDER_ID', () => {
  it('是字符串', () => {
    expect(typeof DEFAULT_PROVIDER_ID).toBe('string');
    expect(DEFAULT_PROVIDER_ID.length).toBeGreaterThan(0);
  });

  it('对应 AI_PROVIDERS 中存在的厂商', () => {
    expect(AI_PROVIDERS.some(p => p.id === DEFAULT_PROVIDER_ID)).toBe(true);
  });
});

describe('getProviderById', () => {
  it('传入有效 id 返回对应 provider', () => {
    const provider = getProviderById('deepseek');
    expect(provider).toBeDefined();
    expect(provider.id).toBe('deepseek');
  });

  it('传入不存在的 id 时返回第一个 provider（兜底）', () => {
    const provider = getProviderById('not-exist');
    expect(provider).toBeDefined();
    expect(provider).toEqual(AI_PROVIDERS[0]);
  });

  it('传入 anthropic 返回 anthropic provider', () => {
    const provider = getProviderById('anthropic');
    expect(provider.id).toBe('anthropic');
    expect(provider.providerType).toBe('anthropic');
  });

  it('传入 undefined 时返回第一个 provider', () => {
    const provider = getProviderById(undefined);
    expect(provider).toEqual(AI_PROVIDERS[0]);
  });

  it('返回的 provider 拥有 models 数组', () => {
    const provider = getProviderById('openai');
    expect(Array.isArray(provider.models)).toBe(true);
    expect(provider.models.length).toBeGreaterThan(0);
  });
});
