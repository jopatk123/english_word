/**
 * 思考模型识别与「禁用 / 降级思考」候选参数构造。
 *
 * 各主流厂商对"关闭思考"的请求字段不一致，且命名与支持范围会随版本变化
 * （例如 GLM-5.3 传 disabled 直接报错、Kimi-K3 改用顶层 reasoning_effort、
 * Claude 4.6+ 新增 adaptive 强度）。这里集中维护：
 *   1. 思考模型识别的正则；
 *   2. 每个厂商 / 模型的候选参数链（关闭思考 → 最低强度 → 不注入）。
 * ai.js 按候选链顺序尝试，遇到上游因参数被拒（400/422）时自动降级重试。
 */

// 按 providerId 分组的思考模型正则。命中任一即视为思考模型。
// Anthropic 模型 ID 同时存在 dot 与 dash 两种写法（claude-3.7-sonnet / claude-3-7-sonnet），
// 字符类 [-.] 同时覆盖两种格式。
// 注意：DeepSeek 新命名（deepseek-flash / deepseek-v4-pro）不再含 "reasoner"/"r1" 字样，
// 但同样是推理模型（响应带 reasoning_content，reasoning_tokens 计入输出额度）。
// 漏判会导致输出被思考耗尽、正文为空而报「AI 服务暂时不可用」，故必须一并匹配。
const THINKING_PATTERNS = {
  deepseek: [/deepseek-reasoner/i, /deepseek-r1/i, /deepseek-v4/i, /deepseek-flash/i],
  zhipu: [/glm-z1/i, /glm-4[-.]\d/i, /glm-5/i, /glm-4-?\w*thinking/i],
  moonshot: [/kimi-k1/i, /kimi-k2/i, /kimi-k3/i, /kimi-thinking/i],
  doubao: [/doubao-seed/i, /doubao-reasoning/i, /doubao-1[-.]5-thinking/i],
  dashscope: [/qwen3/i, /qwq/i],
  openai: [/\bo1\b/i, /\bo3\b/i, /\bo4\b/i, /\bgpt-5\b/i],
  anthropic: [/claude-3[-.]7/i, /claude-(opus|sonnet|haiku)-4/i, /claude-mythos/i],
  groq: [/gpt-oss/i, /qwen3/i],
};

// 厂商默认候选参数。
// close：首选「关闭思考」参数；minimal：次选「最低思考强度」参数。
// null 表示该厂商 / 模型没有对应可用字段（交由候选链自然跳过）。
const PROVIDER_DEFAULTS = {
  deepseek: {
    close: { thinking: { type: 'disabled' } },
    minimal: { reasoning_effort: 'low' },
  },
  zhipu: {
    close: { thinking: { type: 'disabled' } },
    minimal: { reasoning_effort: 'minimal' },
  },
  moonshot: {
    close: { thinking: { type: 'disabled' } },
    minimal: null,
  },
  doubao: {
    close: { thinking: { type: 'disabled' } },
    minimal: null,
  },
  dashscope: {
    close: { enable_thinking: false },
    minimal: null,
  },
  openai: {
    // gpt-5.1 起非 pro 型号默认不思考，reasoning_effort: none 即关闭；
    // o 系列与 gpt-5-pro 只接受更高档位，见 MODEL_OVERRIDES。
    close: { reasoning_effort: 'none' },
    minimal: { reasoning_effort: 'minimal' },
  },
  anthropic: {
    // disabled 对当前所有 Claude 模型仍有效；4.6+ 亦可用 adaptive + effort 降低强度。
    close: { thinking: { type: 'disabled' } },
    minimal: { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
  },
  groq: {
    // gpt-oss：低强度 + 隐藏思考内容，避免 reasoning 泄漏到正文。
    close: { reasoning_effort: 'low', reasoning_format: 'hidden' },
    minimal: null,
  },
};

// 模型级例外（按厂商 key 归类）。比厂商默认更具体，优先匹配。
// close / minimal 为 null 表示该模型无对应参数可用（强制思考或字段改名）。
const MODEL_OVERRIDES = {
  zhipu: [
    // GLM-5.3 系列传 disabled 直接报错，只能靠最低强度。
    { match: [/glm-5[-.]3/i], close: null, minimal: { reasoning_effort: 'low' } },
    // GLM-4.7 强制思考，且不支持 reasoning_effort。
    { match: [/glm-4[-.]7/i], close: null, minimal: null },
  ],
  moonshot: [
    // K2.7-Code 恒思考，只接受 thinking enabled 或省略，无法降级。
    { match: [/kimi-k2[-.]7/i], close: null, minimal: null },
    // K3 已无 thinking 参数，只能通过顶层 reasoning_effort 降低强度。
    {
      match: [/kimi-k3/i],
      close: { reasoning_effort: 'low' },
      minimal: { reasoning_effort: 'low' },
    },
  ],
  openai: [
    // gpt-5.x-pro 只接受 medium/high/xhigh（传 low/none 会 400）。
    { match: [/gpt-5[\w.-]*pro/i], close: null, minimal: { reasoning_effort: 'medium' } },
    // o 系列只接受 low/medium/high（传 none/minimal 会 400）。
    { match: [/\bo[1-4]\b/i], close: null, minimal: { reasoning_effort: 'low' } },
  ],
  anthropic: [
    // mythos-preview 不支持 disabled；默认即不思考，无需注入。
    { match: [/claude-mythos/i], close: null, minimal: null },
  ],
  dashscope: [
    // 纯思考型模型（qwq、qwen3-*-thinking）无法关闭思考，不注入。
    { match: [/qwq/i, /qwen3.*thinking/i], close: null, minimal: null },
  ],
  groq: [
    // qwen3.8 使用 none 关闭思考。
    { match: [/qwen3/i], close: { reasoning_effort: 'none' }, minimal: null },
  ],
};

const matchesAnyPattern = (patterns, model) =>
  Array.isArray(patterns) && patterns.some((re) => re.test(model));

/**
 * 归一化厂商标识：Anthropic 走独立协议分支，其余按 providerId 归类。
 * @returns {string}
 */
const resolveProviderKey = (providerId, providerType, providerMode) => {
  if (providerType === 'anthropic' || providerMode === 'anthropic' || providerId === 'anthropic') {
    return 'anthropic';
  }
  return typeof providerId === 'string' ? providerId : '';
};

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
 * @param {{ providerId?: string, providerType?: string, providerMode?: string, model?: string }} ctx
 * @returns {boolean}
 */
export function isThinkingModel({ providerId, providerType, providerMode, model } = {}) {
  if (typeof model !== 'string' || !model.trim()) return false;

  const key = resolveProviderKey(providerId, providerType, providerMode);
  if (matchesAnyPattern(THINKING_PATTERNS[key], model)) {
    return true;
  }

  return Object.values(THINKING_PATTERNS).some((patterns) => matchesAnyPattern(patterns, model));
}

const resolveRuleForProvider = (providerKey, model) => {
  const overrides = MODEL_OVERRIDES[providerKey];
  if (Array.isArray(overrides)) {
    const hit = overrides.find((rule) => matchesAnyPattern(rule.match, model));
    if (hit) {
      return { close: hit.close, minimal: hit.minimal };
    }
  }
  const defaults = PROVIDER_DEFAULTS[providerKey];
  if (!defaults) return null;
  return { close: defaults.close, minimal: defaults.minimal };
};

const resolveRule = (providerKey, model) => {
  const scoped = resolveRuleForProvider(providerKey, model);
  if (scoped) return scoped;

  // 自定义 / 未知 provider：按模型名归属到已知厂商族，复用其规则。
  // （例如自建代理转发 deepseek-reasoner，仍应注入禁用参数。）
  const family = matchThinkingPatternKey(model);
  if (family && family !== providerKey) {
    return resolveRuleForProvider(family, model);
  }
  return null;
};

const dedupeCandidates = (candidates) => {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    const signature = JSON.stringify(candidate);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(candidate);
  }
  return result;
};

/**
 * 构造要 merge 到上游请求体的候选思考参数链。
 *
 * 顺序为：关闭思考 → 最低思考强度 → 不注入（空对象兜底）。
 * ai.js 会按此顺序尝试，仅当上游以 4xx 拒绝「注入参数」时才降级到下一个。
 * 非思考模型 / 无法降级的强制思考模型返回 [{}]，即不做任何注入。
 *
 * @param {{ providerId?: string, providerType?: string, providerMode?: string, model?: string }} ctx
 * @returns {Object[]}
 */
export function buildThinkingParamCandidates({
  providerId,
  providerType,
  providerMode,
  model,
} = {}) {
  if (!isThinkingModel({ providerId, providerType, model })) {
    return [{}];
  }

  const providerKey = resolveProviderKey(providerId, providerType, providerMode);
  const rule = resolveRule(providerKey, model);
  if (!rule) {
    return [{}];
  }

  return dedupeCandidates([rule.close, rule.minimal, {}].filter((item) => item !== null));
}
