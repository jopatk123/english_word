import dns from 'dns/promises';
import net from 'net';

const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  'openai',
  'nvidia-nim',
  'mistral',
  'groq',
  'dashscope',
  'doubao',
  'hunyuan',
  'qianfan',
  'zhipu',
  'baichuan',
  'deepseek',
  'moonshot',
  'siliconflow',
  'lingyiwanwu',
]);

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl || typeof baseUrl !== 'string') return '';
  return baseUrl.trim().replace(/\/+$/, '');
};

export class AiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiConfigError';
    this.statusCode = 400;
  }
}

export class AiUpstreamError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'AiUpstreamError';
    this.statusCode = statusCode;
  }
}

export class AiTimeoutError extends AiUpstreamError {
  constructor(message = 'AI 服务调用超时，请稍后重试') {
    super(message, 504);
    this.name = 'AiTimeoutError';
  }
}

const mapAiResponseStatus = (status) => {
  if ([400, 401, 403, 404].includes(status)) return 400;
  if (status === 408) return 504;
  if (status === 429) return 429;
  return 502;
};

/**
 * 检测 URL 是否指向私有/环回/本地网络地址（SSRF 防护）。
 * 仅做字面量匹配，不做 DNS 解析，可拦截最常见的攻击向量。
 */
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 链路本地 / AWS/GCP 元数据端点
  /^0\.0\.0\.0$/,
  /^::1$/, // IPv6 环回
  /^\[::1\]$/,
  /^fc[0-9a-f]{2}:/i, // IPv6 唯一本地地址 fc00::/7
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i, // IPv6 链路本地
];

const IPV4_PRIVATE_RANGES = [
  { prefix: '127.', message: '环回地址' },
  { prefix: '10.', message: '私有网络地址' },
  { prefix: '192.168.', message: '私有网络地址' },
  { prefix: '169.254.', message: '链路本地地址' },
];

function isPrivateIpv4(address) {
  for (const { prefix } of IPV4_PRIVATE_RANGES) {
    if (address.startsWith(prefix)) {
      return true;
    }
  }

  const octets = address.split('.').map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  if (octets[0] === 0) return true;
  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

function normalizeIpAddress(address) {
  if (typeof address !== 'string') return '';
  const trimmed = address.trim().toLowerCase();
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

function isPrivateIpAddress(address) {
  const normalized = normalizeIpAddress(address);
  const version = net.isIP(normalized);
  if (version === 4) {
    return isPrivateIpv4(normalized);
  }
  if (version === 6) {
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }
  return false;
}

const assertSafeBaseUrl = (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AiConfigError(
      'AI baseUrl 格式无效，请填写完整的 URL（如 https://api.openai.com/v1）'
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AiConfigError('AI baseUrl 仅支持 http 或 https 协议');
  }

  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new AiConfigError(
        'AI baseUrl 不允许指向本地或私有网络地址，请填写公网可访问的 API 地址'
      );
    }
  }
};

const assertPublicResolvedHostname = async (rawUrl) => {
  const parsed = new URL(rawUrl);
  let records;

  try {
    records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new AiConfigError('AI baseUrl 域名解析失败，请确认地址可访问');
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new AiConfigError('AI baseUrl 域名解析失败，请确认地址可访问');
  }

  if (records.some((record) => isPrivateIpAddress(record.address))) {
    throw new AiConfigError('AI baseUrl 解析结果指向本地或私有网络地址，已拒绝请求');
  }
};

const getProviderMode = (providerId, providerType) => {
  if (providerType === 'anthropic' || providerId === 'anthropic') {
    return 'anthropic';
  }
  if (providerType === 'openai-compatible' || OPENAI_COMPATIBLE_PROVIDERS.has(providerId)) {
    return 'openai-compatible';
  }
  return 'openai-compatible';
};

const normalizeContentText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
};

const extractJsonCandidate = (text) => {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
};

const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractFirstJsonValue = (text) => {
  const directCandidate = extractJsonCandidate(text);
  const directParsed = tryParseJson(directCandidate);
  if (directParsed) return directParsed;

  const stack = [];
  let startIndex = -1;

  for (let index = 0; index < directCandidate.length; index += 1) {
    const char = directCandidate[index];
    if (char === '{' || char === '[') {
      if (stack.length === 0) {
        startIndex = index;
      }
      stack.push(char === '{' ? '}' : ']');
      continue;
    }

    if (stack.length && char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0 && startIndex >= 0) {
        const candidate = directCandidate.slice(startIndex, index + 1);
        const parsed = tryParseJson(candidate);
        if (parsed) return parsed;
        startIndex = -1;
      }
    }
  }

  return null;
};

const trimText = (value, maxLength = 200) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

export const validateAiConfig = (config = {}) => {
  const apiKey = trimText(config.apiKey, 300);
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = trimText(config.model, 120);
  const providerId = trimText(config.providerId, 80);
  const providerType = trimText(config.providerType, 80);

  if (!apiKey || !baseUrl || !model || !providerId) {
    throw new AiConfigError('AI 配置不完整，请先填写厂商、Base URL、模型和 API Key');
  }

  assertSafeBaseUrl(baseUrl);

  const rawTemp = parseFloat(config.temperature);
  const temperature =
    !isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? Math.round(rawTemp * 100) / 100 : 0.2;

  return {
    apiKey,
    baseUrl,
    model,
    providerId,
    providerType,
    providerMode: getProviderMode(providerId, providerType),
    temperature,
  };
};

const AI_REQUEST_TIMEOUT_MS = 60_000;

const callOpenAICompatible = async ({
  apiKey,
  baseUrl,
  model,
  temperature,
  systemPrompt,
  userPrompt,
}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    throw new AiUpstreamError('AI 服务网络连接失败，请稍后重试');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.message || 'AI 服务调用失败';
    throw new AiUpstreamError(errorMessage, mapAiResponseStatus(response.status));
  }

  const content = payload?.choices?.[0]?.message?.content;
  return normalizeContentText(content);
};

const callAnthropic = async ({ apiKey, baseUrl, model, temperature, systemPrompt, userPrompt }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new AiTimeoutError();
    }
    throw new AiUpstreamError('AI 服务网络连接失败，请稍后重试');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.message || 'AI 服务调用失败';
    throw new AiUpstreamError(errorMessage, mapAiResponseStatus(response.status));
  }

  return normalizeContentText(payload?.content);
};

export const requestAiJson = async (config, prompts) => {
  const normalizedConfig = validateAiConfig(config);
  await assertPublicResolvedHostname(normalizedConfig.baseUrl);
  const requestPayload = {
    ...normalizedConfig,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  };

  const rawText =
    normalizedConfig.providerMode === 'anthropic'
      ? await callAnthropic(requestPayload)
      : await callOpenAICompatible(requestPayload);

  if (!rawText) {
    throw new AiUpstreamError('AI 未返回有效内容');
  }

  const parsed = extractFirstJsonValue(rawText);
  if (!parsed || typeof parsed !== 'object') {
    throw new AiUpstreamError('AI 返回内容无法解析为 JSON，请更换模型或重试');
  }

  return parsed;
};

const VALID_POS_TYPES = new Set([
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'pron.',
  'conj.',
  'interj.',
  'num.',
  'art.',
  'aux.',
]);

export const sanitizeRootSuggestions = (items, existingNames = []) => {
  const nameSet = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const name = trimText(item?.name, 40).toLowerCase();
    const meaning = trimText(item?.meaning, 80);

    if (!/^[a-z-]{2,40}$/.test(name) || !meaning) {
      continue;
    }
    if (nameSet.has(name)) {
      continue;
    }

    nameSet.add(name);
    result.push({ name, meaning });
    if (result.length >= 10) break;
  }

  return result;
};

export const sanitizeWordSuggestions = (items, existingNames = []) => {
  const nameSet = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const name = trimText(item?.name, 60).toLowerCase();
    const meaning = trimText(item?.meaning, 120);
    const phonetic = trimText(item?.phonetic || '', 80);

    if (!/^[a-z][a-z-]{1,59}$/.test(name) || !meaning) {
      continue;
    }
    if (nameSet.has(name)) {
      continue;
    }

    const posItems = Array.isArray(item?.partOfSpeech) ? item.partOfSpeech : [];
    const partOfSpeech = [];
    for (const pos of posItems) {
      const type = (pos?.type || '').trim().toLowerCase();
      const posMeaning = trimText(pos?.meaning || '', 160);
      if (VALID_POS_TYPES.has(type) && posMeaning) {
        partOfSpeech.push({ type, meaning: posMeaning });
        if (partOfSpeech.length >= 8) break;
      }
    }

    nameSet.add(name);
    result.push({ name, meaning, phonetic, partOfSpeech });
    if (result.length >= 12) break;
  }

  return result;
};

export const sanitizeExampleSuggestions = (items, existingSentences = []) => {
  const sentenceSet = new Set(existingSentences.map((sentence) => sentence.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const sentence = trimText(item?.sentence, 400);
    const translation = trimText(item?.translation, 240);
    const normalizedSentence = sentence.toLowerCase();

    if (!sentence || !translation || sentence.length < 8) {
      continue;
    }
    if (sentenceSet.has(normalizedSentence)) {
      continue;
    }

    sentenceSet.add(normalizedSentence);
    result.push({ sentence, translation });
    if (result.length >= 8) break;
  }

  return result;
};
