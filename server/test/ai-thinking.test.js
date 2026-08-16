import { describe, expect, it } from 'vitest';
import { buildThinkingDisableParams, isThinkingModel } from '../utils/aiThinking.js';

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

  it('Qwen3.7-Plus 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'dashscope', model: 'qwen3.7-plus' })).toBe(true);
  });

  it('Qwen2.5 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'dashscope', model: 'qwen2.5-max' })).toBe(false);
  });

  it('QwQ 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'dashscope', model: 'qwq-32b' })).toBe(true);
  });

  it('OpenAI o1 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'o1' })).toBe(true);
  });

  it('OpenAI o3-mini 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'o3-mini' })).toBe(true);
  });

  it('OpenAI gpt-5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'gpt-5' })).toBe(true);
  });

  it('OpenAI gpt-4o 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'openai', model: 'gpt-4o' })).toBe(false);
  });

  it('Claude 3.7 Sonnet 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3-7-sonnet' })).toBe(true);
  });

  it('Claude Opus 4 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-opus-4-20250514' })).toBe(
      true
    );
  });

  it('Claude Sonnet 4.5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-sonnet-4-5' })).toBe(true);
  });

  it('Claude Opus 4.6 仍是思考模型（isThinkingModel 不排除）', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-opus-4-6' })).toBe(true);
  });

  it('Claude 3 Opus 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3-opus' })).toBe(false);
  });

  it('Claude 3.5 Sonnet 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-3-5-sonnet' })).toBe(false);
  });

  it('GLM-Z1 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-z1-air' })).toBe(true);
  });

  it('GLM-4.5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-4.5' })).toBe(true);
  });

  it('GLM-4 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-4' })).toBe(false);
  });

  it('Kimi K1.5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'kimi-k1.5' })).toBe(true);
  });

  it('Moonshot-v1 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'moonshot-v1-8k' })).toBe(false);
  });

  it('Doubao Seed 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'doubao', model: 'doubao-seed-1-6-251015' })).toBe(true);
  });

  it('Doubao 1.5 Pro 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'doubao', model: 'doubao-1.5-pro' })).toBe(false);
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

describe('buildThinkingDisableParams', () => {
  it('skipThinking=false 返回空对象', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
        skipThinking: false,
      })
    ).toEqual({});
  });

  it('skipThinking 未传返回空对象', () => {
    expect(
      buildThinkingDisableParams({ providerId: 'deepseek', model: 'deepseek-reasoner' })
    ).toEqual({});
  });

  it('skipThinking 字符串 "true" 视为 false', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
        skipThinking: 'true',
      })
    ).toEqual({});
  });

  it('skipThinking=1 视为 false', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
        skipThinking: 1,
      })
    ).toEqual({});
  });

  it('DeepSeek 思考模型注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('DeepSeek 非思考模型不注入', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'deepseek',
        model: 'deepseek-chat',
        skipThinking: true,
      })
    ).toEqual({});
  });

  it('DashScope Qwen3 注入 enable_thinking false', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'dashscope',
        model: 'qwen3-max',
        skipThinking: true,
      })
    ).toEqual({ enable_thinking: false });
  });

  it('OpenAI o1 注入 reasoning_effort low（不注入 thinking）', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'openai',
        model: 'o1',
        skipThinking: true,
      })
    ).toEqual({ reasoning_effort: 'low' });
  });

  it('OpenAI gpt-4o 非思考模型不注入', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'openai',
        model: 'gpt-4o',
        skipThinking: true,
      })
    ).toEqual({});
  });

  it('Anthropic Claude 3.7 注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-3-7-sonnet',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('Anthropic Claude Opus 4 注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-opus-4-20250514',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('Anthropic Claude Opus 4.6 不注入（已废弃）', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-opus-4-6',
        skipThinking: true,
      })
    ).toEqual({});
  });

  it('Anthropic Claude 3 Opus 非思考模型不注入', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-3-opus',
        skipThinking: true,
      })
    ).toEqual({});
  });

  it('GLM-Z1 注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'zhipu',
        model: 'glm-z1-air',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('Kimi K2 注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'moonshot',
        model: 'kimi-k2',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('Doubao Seed 注入 thinking disabled', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'doubao',
        model: 'doubao-seed-1-6',
        skipThinking: true,
      })
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('未知 provider 不注入', () => {
    expect(
      buildThinkingDisableParams({
        providerId: 'unknown',
        model: 'whatever',
        skipThinking: true,
      })
    ).toEqual({});
  });

  it('DeepSeek 思考模型不注入 reasoning_effort（避免与 thinking 冲突）', () => {
    const result = buildThinkingDisableParams({
      providerId: 'deepseek',
      model: 'deepseek-reasoner',
      skipThinking: true,
    });
    expect(result).not.toHaveProperty('reasoning_effort');
    expect(result).not.toHaveProperty('enable_thinking');
  });

  it('OpenAI 思考模型不注入 thinking 字段（避免与 reasoning_effort 冲突）', () => {
    const result = buildThinkingDisableParams({
      providerId: 'openai',
      model: 'o1',
      skipThinking: true,
    });
    expect(result).not.toHaveProperty('thinking');
    expect(result).not.toHaveProperty('enable_thinking');
  });

  it('无参数返回空对象', () => {
    expect(buildThinkingDisableParams()).toEqual({});
  });
});
