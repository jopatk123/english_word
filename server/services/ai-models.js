import {
  AiTimeoutError,
  AiUpstreamError,
  assertPublicResolvedHostname,
  mapAiResponseStatus,
} from '../utils/ai.js';

const MODEL_FETCH_TIMEOUT_MS = 30_000;

const buildModelListHeaders = (config) => {
  if (config.providerMode === 'anthropic') {
    return {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  return { Authorization: `Bearer ${config.apiKey}` };
};

const extractModelIds = (payload) => {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const ids = items
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter((id) => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());

  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
};

export async function fetchProviderModels(config) {
  await assertPublicResolvedHostname(config.baseUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${config.baseUrl}/models`, {
      method: 'GET',
      signal: controller.signal,
      headers: buildModelListHeaders(config),
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new AiTimeoutError('获取模型列表超时，请稍后重试');
    }
    throw new AiUpstreamError('获取模型列表失败，无法连接到 AI 服务');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.message || 'AI 厂商返回错误';
    throw new AiUpstreamError(errorMessage, mapAiResponseStatus(response.status));
  }

  const models = extractModelIds(payload);
  if (models.length === 0) {
    throw new AiUpstreamError('AI 厂商未返回任何可用模型');
  }

  return { models, rawCount: models.length };
}
