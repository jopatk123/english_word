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
  deepseek: [/deepseek-reasoner/i, /deepseek-r1/i, /deepseek-v4/i],
  zhipu: [/glm-z1/i, /glm-4[-.]5/i, /glm-4[-.]6/i, /glm-4-?\w*thinking/i],
  moonshot: [/kimi-k1/i, /kimi-k2/i, /kimi-thinking/i],
  doubao: [/doubao-seed/i, /doubao-reasoning/i, /doubao-1[-.]5-thinking/i],
  dashscope: [/qwen3/i, /qwq/i],
  openai: [/\bo1\b/i, /\bo3\b/i, /\bo4\b/i, /\bgpt-5\b/i],
  anthropic: [/claude-3[-.]7/i, /claude-(opus|sonnet|haiku)-4([-.]5)?\b/i],
};

const MODEL_DISABLE_PARAMS = {
  deepseek: { thinking: { type: 'disabled' } },
  dashscope: { enable_thinking: false },
  openai: { reasoning_effort: 'low' },
  zhipu: { thinking: { type: 'disabled' } },
  moonshot: { thinking: { type: 'disabled' } },
  doubao: { thinking: { type: 'disabled' } },
  anthropic: { thinking: { type: 'disabled' } },
};

// Anthropic 4.6+ 已废弃 thinking.type: enabled/disabled，命中即不注入。
const ANTHROPIC_DISABLED_PATTERNS = [/claude-(opus|sonnet|haiku)-4[-.]6/i, /claude-4[-.]6/i];

const getPatternsKey = (providerId, providerType) => {
  if (providerType === 'anthropic' || providerId === 'anthropic') {
    return 'anthropic';
  }
  return providerId;
};

const matchesAnyPattern = (patterns, model) =>
  Array.isArray(patterns) && patterns.some((re) => re.test(model));

const matchThinkingPatternKey = (model) => {
  for (const [key, patterns] of Object.entries(THINKING_PATTERNS)) {
    if (matchesAnyPattern(patterns, model)) {
      return key;
    }
  }
  return null;
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
  if (matchesAnyPattern(THINKING_PATTERNS[key], model)) {
    return true;
  }

  return Object.values(THINKING_PATTERNS).some((patterns) => matchesAnyPattern(patterns, model));
}

/**
 * 判定某 Anthropic 模型是否已废弃 thinking.type 参数（4.6+）。
 *
 * @param {string} model
 * @returns {boolean}
 */
const isAnthropicThinkingParamDeprecated = (model) =>
  ANTHROPIC_DISABLED_PATTERNS.some((re) => re.test(model));

const getProviderDisableParams = ({ providerId, providerMode, model }) => {
  if (
    (providerMode === 'anthropic' || providerId === 'anthropic') &&
    isAnthropicThinkingParamDeprecated(model)
  ) {
    return {};
  }

  if (providerId === 'deepseek') {
    return { thinking: { type: 'disabled' } };
  }

  if (providerId === 'dashscope') {
    return { enable_thinking: false };
  }

  if (providerId === 'openai') {
    return { reasoning_effort: 'low' };
  }

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
};

const getModelMatchedDisableParams = (model) => {
  const matchedKey = matchThinkingPatternKey(model);
  if (!matchedKey) return {};

  if (matchedKey === 'anthropic' && isAnthropicThinkingParamDeprecated(model)) {
    return {};
  }

  return MODEL_DISABLE_PARAMS[matchedKey] || {};
};

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

  const providerParams = getProviderDisableParams({
    providerId,
    providerMode,
    model,
  });
  if (Object.keys(providerParams).length > 0) {
    return providerParams;
  }

  return getModelMatchedDisableParams(model);
}
