/**
 * AI 请求调试与日志工具
 * - maskApiKey: 脱敏 API Key 用于日志展示
 * - createDebugInfo: 构建请求级别的调试上下文
 * - withDuration: 为 debugInfo 附加耗时信息
 * - logAiInfo / logAiError: 统一的 AI 日志输出
 */

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
