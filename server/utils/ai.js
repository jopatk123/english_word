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
    throw new Error('AI 配置不完整，请先填写厂商、Base URL、模型和 API Key');
  }

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

const callOpenAICompatible = async ({
  apiKey,
  baseUrl,
  model,
  temperature,
  systemPrompt,
  userPrompt,
}) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.message || 'AI 服务调用失败';
    throw new Error(errorMessage);
  }

  const content = payload?.choices?.[0]?.message?.content;
  return normalizeContentText(content);
};

const callAnthropic = async ({ apiKey, baseUrl, model, temperature, systemPrompt, userPrompt }) => {
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.message || 'AI 服务调用失败';
    throw new Error(errorMessage);
  }

  return normalizeContentText(payload?.content);
};

export const requestAiJson = async (config, prompts) => {
  const normalizedConfig = validateAiConfig(config);
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
    throw new Error('AI 未返回有效内容');
  }

  const parsed = extractFirstJsonValue(rawText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回内容无法解析为 JSON，请更换模型或重试');
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
