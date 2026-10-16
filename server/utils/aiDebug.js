/**
 * AI 请求调试与日志工具
 * - maskApiKey: 脱敏 API Key 用于日志展示
 * - createDebugInfo: 构建请求级别的调试上下文
 * - withDuration: 为 debugInfo 附加耗时信息
 * - logAiInfo / logAiError: 统一的 AI 日志输出
 * - handleAiError: AI 路由统一错误响应
 */
import { error, resolveClientErrorStatus } from './response.js';

export const maskApiKey = (apiKey = '') => {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

export const createDebugInfo = (req, config, startedAt) => ({
  requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  providerId: config?.providerId || '',
  providerType: config?.providerType || '',
  baseUrl: config?.baseUrl || '',
  model: config?.model || '',
  apiKeyMasked: maskApiKey(config?.apiKey),
  method: req.method,
  path: req.originalUrl,
  startedAt,
});

export const withDuration = (debugInfo) => ({
  ...debugInfo,
  durationMs: Date.now() - debugInfo.startedAt,
});

export const logAiInfo = (message, debugInfo, extra = {}) => {
  console.log(`[AI] ${message}`, JSON.stringify({ ...withDuration(debugInfo), ...extra }));
};

export const logAiError = (message, debugInfo, err, extra = {}) => {
  console.error(
    `[AI] ${message}`,
    JSON.stringify({
      ...withDuration(debugInfo),
      error: err?.message || 'unknown error',
      ...extra,
    })
  );
};

const AI_UNEXPECTED_FAILURE_MSG = 'AI 服务暂时不可用，请稍后重试';

/**
 * AI 路由 catch 分支的统一响应：4xx 回传原始提示，其余折叠为带 requestId 的兜底文案。
 */
export const handleAiError = (res, req, startedAt, route, e, extra = {}) => {
  const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
  logAiError(`${route}.error`, debugInfo, e, extra);

  const clientStatus = resolveClientErrorStatus(e);
  if (clientStatus && e?.message) {
    return error(res, e.message, clientStatus);
  }

  const statusCode = Number.isInteger(e?.statusCode) ? e.statusCode : 502;
  const safeStatus = statusCode >= 500 ? statusCode : 502;
  error(res, `${AI_UNEXPECTED_FAILURE_MSG} [requestId=${debugInfo.requestId}]`, safeStatus);
};
