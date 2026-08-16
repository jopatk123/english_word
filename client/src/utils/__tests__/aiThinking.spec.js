import { describe, expect, it } from 'vitest';
import { isThinkingModel } from '../aiThinking.js';

describe('isThinkingModel', () => {
  it('DeepSeek-Reasoner 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-reasoner' })).toBe(true);
  });

  it('DeepSeek-R1 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-r1' })).toBe(true);
  });

  it('DeepSeek-V4-Pro 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-v4-pro' })).toBe(true);
  });

  it('DeepSeek-Chat 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-chat' })).toBe(false);
  });

  it('Qwen3-Max 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'dashscope', model: 'qwen3-max' })).toBe(true);
  });

  it('Qwen2.5 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'dashscope', model: 'qwen2.5-max' })).toBe(false);
  });

  it('OpenAI o1 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'o1' })).toBe(true);
  });

  it('OpenAI gpt-4o 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'gpt-4o' })).toBe(false);
  });

  it('Claude 3.7 Sonnet (dash 写法) 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3-7-sonnet' })).toBe(true);
  });

  it('Claude 3.7 Sonnet (dot 写法) 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3.7-sonnet' })).toBe(true);
  });

  it('Claude Opus 4 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-opus-4-20250514' })).toBe(
      true
    );
  });

  it('Claude 3 Opus 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3-opus' })).toBe(false);
  });

  it('GLM-Z1 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-z1-air' })).toBe(true);
  });

  it('Kimi K1.5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'kimi-k1.5' })).toBe(true);
  });

  it('Doubao Seed 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'doubao', model: 'doubao-seed-1-6-251015' })).toBe(true);
  });

  it('Anthropic 通过 providerType 识别', () => {
    expect(isThinkingModel({ providerType: 'anthropic', model: 'claude-3-7-sonnet' })).toBe(true);
  });

  it('空 model 返回 false', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: '' })).toBe(false);
    expect(isThinkingModel({ providerId: 'deepseek', model: undefined })).toBe(false);
    expect(isThinkingModel({ providerId: 'deepseek', model: null })).toBe(false);
  });

  it('未知 provider 返回 false', () => {
    expect(isThinkingModel({ providerId: 'unknown', model: 'whatever' })).toBe(false);
  });

  it('无参数返回 false', () => {
    expect(isThinkingModel()).toBe(false);
  });
});
