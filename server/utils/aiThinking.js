/**
 * 思考模型识别与禁用参数构造。
 *
 * 各主流厂商对"禁用思考"的请求字段不一致，且部分厂商（如 Anthropic 4.6+）
 * 已废弃旧字段。这里集中维护匹配规则与禁用参数映射，供 ai.js 在构造
 * 上游请求体时按需 merge。
 */

// 按 providerId 分组的思考模型正则。命中任一即视为思考模型。
// Anthropic 模型 ID 同时存在 dot 与 dash 两种写法（claude-3.7-sonnet / claude-3-7-sonnet），
// 字符类 [-.] 同时覆盖两种格式。
const THINKING_PATTERNS = {
  deepseek: [/deepseek-reasoner/i, /deepseek-r1/i, /deepseek-v4-pro/i],
  zhipu: [/glm-z1/i, /glm-4[-.]5/i, /glm-4[-.]6/i, /glm-4-?\w*thinking/i],
  moonshot: [/kimi-k1/i, /kimi-k2/i, /kimi-thinking/i],
  doubao: [/doubao-seed/i, /doubao-reasoning/i, /doubao-1[-.]5-thinking/i],
  dashscope: [/qwen3/i, /qwq/i],
  openai: [/\bo1\b/i, /\bo3\b/i, /\bo4\b/i, /\bgpt-5\b/i],
  anthropic: [/claude-3[-.]7/i, /claude-(opus|sonnet|haiku)-4([-.]5)?\b/i],
};

// Anthropic 4.6+ 已废弃 thinking.type: enabled/disabled，命中即不注入。
const ANTHROPIC_DISABLED_PATTERNS = [/claude-(opus|sonnet|haiku)-4[-.]6/i, /claude-4[-.]6/i];

const getPatternsKey = (providerId, providerType) => {
  if (providerType === 'anthropic' || providerId === 'anthropic') {
    return 'anthropic';
  }
  return providerId;
};

/**
 * 判定某 provider+model 是否属于思考型模型。
 * 仅用于 UI 提示与决定是否需要选择性注入禁用参数；不阻塞请求。
 *
 * @param {{ providerId?: string, providerType?: string, model?: string }} ctx
 * @returns {boolean}
 */
export function isThinkingModel({ providerId, providerType, model } = {}) {
  if (typeof model !== 'string' || !model.trim()) return false;
  const key = getPatternsKey(providerId, providerType);
  const patterns = THINKING_PATTERNS[key];
  if (!Array.isArray(patterns)) return false;
  return patterns.some((re) => re.test(model));
}

/**
 * 判定某 Anthropic 模型是否已废弃 thinking.type 参数（4.6+）。
 *
 * @param {string} model
 * @returns {boolean}
 */
const isAnthropicThinkingParamDeprecated = (model) =>
  ANTHROPIC_DISABLED_PATTERNS.some((re) => re.test(model));

/**
 * 根据 skipThinking 与 provider/model 决定要 merge 到上游请求体的禁用参数。
 * 返回 {} 表示不注入。
 *
 * @param {{ providerId?: string, providerType?: string, providerMode?: string, model?: string, skipThinking?: boolean }} ctx
 * @returns {Object}
 */
export function buildThinkingDisableParams({
  providerId,
  providerType,
  providerMode,
  model,
  skipThinking,
} = {}) {
  if (skipThinking !== true) return {};
  if (!isThinkingModel({ providerId, providerType, model })) return {};

  // Anthropic 4.6+ 已废弃 thinking.type 字段，传了会被拒绝。
  if (
    (providerMode === 'anthropic' || providerId === 'anthropic') &&
    isAnthropicThinkingParamDeprecated(model)
  ) {
    return {};
  }

  // DeepSeek 与 reasoning_effort 互斥，对 deepseek 只发 thinking 字段。
  if (providerId === 'deepseek') {
    return { thinking: { type: 'disabled' } };
  }

  // Qwen3 系列（DashScope OpenAI 兼容模式）使用 enable_thinking 顶层字段。
  if (providerId === 'dashscope') {
    return { enable_thinking: false };
  }

  // OpenAI o-series / gpt-5 使用 reasoning_effort；保守用 low，兼容老模型。
  if (providerId === 'openai') {
    return { reasoning_effort: 'low' };
  }

  // GLM-Z1 / Kimi / 豆包 / Claude 3.7+/4/4.5 都使用 thinking: disabled。
  if (
    providerId === 'zhipu' ||
    providerId === 'moonshot' ||
    providerId === 'doubao' ||
    providerMode === 'anthropic' ||
    providerId === 'anthropic'
  ) {
    return { thinking: { type: 'disabled' } };
  }

  return {};
}
