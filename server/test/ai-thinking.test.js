import { describe, expect, it } from 'vitest';
import { buildThinkingParamCandidates, isThinkingModel } from '../utils/aiThinking.js';

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

  it('DeepSeek-V4-Flash 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-v4-flash' })).toBe(true);
  });

  it('DeepSeek-V4 基础型号是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-v4' })).toBe(true);
  });

  it('DeepSeek-Flash 新命名（不含 v4）也是思考模型', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: 'deepseek-flash' })).toBe(true);
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

  it('Claude Opus 4.6 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-opus-4-6' })).toBe(true);
  });

  it('Claude Mythos 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'anthropic', model: 'claude-mythos-preview' })).toBe(true);
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

  it('GLM-4.7 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-4.7' })).toBe(true);
  });

  it('GLM-5.3 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-5.3-flash' })).toBe(true);
  });

  it('GLM-4 非思考模型', () => {
    expect(isThinkingModel({ providerId: 'zhipu', model: 'glm-4' })).toBe(false);
  });

  it('Kimi K1.5 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'kimi-k1.5' })).toBe(true);
  });

  it('Kimi K2.6 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'kimi-k2.6' })).toBe(true);
  });

  it('Kimi K3 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'moonshot', model: 'kimi-k3' })).toBe(true);
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

  it('Groq gpt-oss 是思考模型', () => {
    expect(isThinkingModel({ providerId: 'groq', model: 'openai/gpt-oss-120b' })).toBe(true);
  });

  it('Anthropic 通过 providerType 识别', () => {
    expect(isThinkingModel({ providerType: 'anthropic', model: 'claude-3-7-sonnet' })).toBe(true);
  });

  it('空 model 返回 false', () => {
    expect(isThinkingModel({ providerId: 'deepseek', model: '' })).toBe(false);
    expect(isThinkingModel({ providerId: 'deepseek', model: undefined })).toBe(false);
    expect(isThinkingModel({ providerId: 'deepseek', model: null })).toBe(false);
  });

  it('未知 provider 按模型名识别思考模型', () => {
    expect(isThinkingModel({ providerId: 'custom_proxy', model: 'deepseek-reasoner' })).toBe(true);
    expect(isThinkingModel({ providerId: 'unknown', model: 'whatever' })).toBe(false);
  });

  it('无参数返回 false', () => {
    expect(isThinkingModel()).toBe(false);
  });
});

describe('buildThinkingParamCandidates', () => {
  it('DeepSeek 思考模型：优先 thinking disabled，次选 reasoning_effort low，兜底不注入', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
      })
    ).toEqual([{ thinking: { type: 'disabled' } }, { reasoning_effort: 'low' }, {}]);
  });

  it('DeepSeek-V4-Flash 使用同样的候选链', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'deepseek',
        model: 'deepseek-v4-flash',
      })
    ).toEqual([{ thinking: { type: 'disabled' } }, { reasoning_effort: 'low' }, {}]);
  });

  it('DeepSeek 非思考模型只返回空对象（不注入）', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'deepseek',
        model: 'deepseek-chat',
      })
    ).toEqual([{}]);
  });

  it('DashScope Qwen3：enable_thinking false，兜底不注入', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'dashscope',
        model: 'qwen3-max',
      })
    ).toEqual([{ enable_thinking: false }, {}]);
  });

  it('DashScope 纯思考型 QwQ 无法关闭，只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'dashscope',
        model: 'qwq-32b',
      })
    ).toEqual([{}]);
  });

  it('OpenAI o 系列只接受 low/medium/high：首选 reasoning_effort low', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'openai',
        model: 'o1',
      })
    ).toEqual([{ reasoning_effort: 'low' }, {}]);
  });

  it('OpenAI gpt-5 非 pro：首选 none，次选 minimal', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'openai',
        model: 'gpt-5',
      })
    ).toEqual([{ reasoning_effort: 'none' }, { reasoning_effort: 'minimal' }, {}]);
  });

  it('OpenAI gpt-5-pro 只接受 medium/high/xhigh：首选 medium', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'openai',
        model: 'gpt-5-pro',
      })
    ).toEqual([{ reasoning_effort: 'medium' }, {}]);
  });

  it('OpenAI gpt-4o 非思考模型只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'openai',
        model: 'gpt-4o',
      })
    ).toEqual([{}]);
  });

  it('Anthropic Claude 3.7：disabled → adaptive+effort low → 不注入', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-3-7-sonnet',
      })
    ).toEqual([
      { thinking: { type: 'disabled' } },
      { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
      {},
    ]);
  });

  it('Anthropic Claude Opus 4.6 仍可用 disabled（此前误判为已废弃）', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-opus-4-6',
      })
    ).toEqual([
      { thinking: { type: 'disabled' } },
      { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
      {},
    ]);
  });

  it('Anthropic Claude Mythos 不支持 disabled，只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-mythos-preview',
      })
    ).toEqual([{}]);
  });

  it('Anthropic Claude 3 Opus 非思考模型只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'anthropic',
        providerMode: 'anthropic',
        model: 'claude-3-opus',
      })
    ).toEqual([{}]);
  });

  it('GLM-Z1：disabled → reasoning_effort minimal → 不注入', () => {
    expect(buildThinkingParamCandidates({ providerId: 'zhipu', model: 'glm-z1-air' })).toEqual([
      { thinking: { type: 'disabled' } },
      { reasoning_effort: 'minimal' },
      {},
    ]);
  });

  it('GLM-5.3 传 disabled 会报错：只用最低强度', () => {
    expect(buildThinkingParamCandidates({ providerId: 'zhipu', model: 'glm-5.3-flash' })).toEqual([
      { reasoning_effort: 'low' },
      {},
    ]);
  });

  it('GLM-4.7 强制思考且不支持 reasoning_effort：只返回空对象', () => {
    expect(buildThinkingParamCandidates({ providerId: 'zhipu', model: 'glm-4.7' })).toEqual([{}]);
  });

  it('Kimi K2.6：disabled → 不注入', () => {
    expect(buildThinkingParamCandidates({ providerId: 'moonshot', model: 'kimi-k2.6' })).toEqual([
      { thinking: { type: 'disabled' } },
      {},
    ]);
  });

  it('Kimi K2.7-Code 恒思考：只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({ providerId: 'moonshot', model: 'kimi-k2.7-code' })
    ).toEqual([{}]);
  });

  it('Kimi K3 改用顶层 reasoning_effort low（去重后只剩一个候选）', () => {
    expect(buildThinkingParamCandidates({ providerId: 'moonshot', model: 'kimi-k3' })).toEqual([
      { reasoning_effort: 'low' },
      {},
    ]);
  });

  it('Doubao Seed：disabled → 不注入', () => {
    expect(
      buildThinkingParamCandidates({ providerId: 'doubao', model: 'doubao-seed-1-6' })
    ).toEqual([{ thinking: { type: 'disabled' } }, {}]);
  });

  it('自定义 provider 按模型名归属厂商族并复用候选链', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'custom_proxy',
        providerType: 'openai-compatible',
        providerMode: 'openai-compatible',
        model: 'deepseek-reasoner',
      })
    ).toEqual([{ thinking: { type: 'disabled' } }, { reasoning_effort: 'low' }, {}]);
  });

  it('未知 provider 且非思考模型只返回空对象', () => {
    expect(
      buildThinkingParamCandidates({
        providerId: 'unknown',
        model: 'whatever',
      })
    ).toEqual([{}]);
  });

  it('候选之间不会混入冲突字段（DeepSeek 不含 reasoning_effort 之外的字段）', () => {
    const [closeCandidate] = buildThinkingParamCandidates({
      providerId: 'deepseek',
      model: 'deepseek-reasoner',
    });
    expect(closeCandidate).not.toHaveProperty('reasoning_effort');
    expect(closeCandidate).not.toHaveProperty('enable_thinking');
  });

  it('无参数返回空对象候选', () => {
    expect(buildThinkingParamCandidates()).toEqual([{}]);
  });
});
