/**
 * 思考模型识别（前端版本）。
 *
 * 与 server/utils/aiThinking.js 中的 isThinkingModel 逻辑保持同构，
 * 用于 AI 配置页判断当前所选模型是否为思考模型，从而决定是否高亮
 * "跳过思考"开关的提示 tag。
 *
 * 注：client/ 与 server/ 是独立 npm 包，无共享目录，故双副本维护。
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

const getPatternsKey = (providerId, providerType) => {
  if (providerType === 'anthropic' || providerId === 'anthropic') {
    return 'anthropic';
  }
  return providerId;
};

/**
 * 判定某 provider+model 是否属于思考型模型。
 * 仅用于 UI 提示；不阻塞任何操作。
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
