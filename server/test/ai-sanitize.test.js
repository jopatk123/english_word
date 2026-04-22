/**
 * 测试：server/utils/ai.js 导出函数
 *   - validateAiConfig
 *   - sanitizeRootSuggestions
 *   - sanitizeWordSuggestions
 *   - sanitizeExampleSuggestions
 *   - requestAiJson (通过 fetch mock)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAiConfig,
  sanitizeRootSuggestions,
  sanitizeWordSuggestions,
  sanitizeExampleSuggestions,
  requestAiJson,
} from '../utils/ai.js';

// ================================================================
// validateAiConfig
// ================================================================

describe('validateAiConfig', () => {
  const validConfig = {
    apiKey: 'sk-test12345678',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    providerId: 'openai',
    providerType: 'openai-compatible',
    temperature: 0.5,
  };

  it('有效配置正常返回', () => {
    const result = validateAiConfig(validConfig);
    expect(result.apiKey).toBe('sk-test12345678');
    expect(result.baseUrl).toBe('https://api.openai.com/v1');
    expect(result.model).toBe('gpt-4o');
    expect(result.providerId).toBe('openai');
    expect(result.temperature).toBeCloseTo(0.5);
  });

  it('缺少 apiKey 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, apiKey: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 baseUrl 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, baseUrl: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 model 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, model: '' })).toThrow('AI 配置不完整');
  });

  it('缺少 providerId 时抛出错误', () => {
    expect(() => validateAiConfig({ ...validConfig, providerId: '' })).toThrow('AI 配置不完整');
  });

  it('空配置对象时抛出错误', () => {
    expect(() => validateAiConfig({})).toThrow('AI 配置不完整');
  });

  it('无参数时抛出错误', () => {
    expect(() => validateAiConfig()).toThrow('AI 配置不完整');
  });

  it('baseUrl 末尾斜杠被去除', () => {
    const result = validateAiConfig({ ...validConfig, baseUrl: 'https://api.openai.com/v1///' });
    expect(result.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('temperature 无效时默认使用 0.2', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 'bad' });
    expect(result.temperature).toBe(0.2);
  });

  it('temperature 超出范围时默认使用 0.2', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 5 });
    expect(result.temperature).toBe(0.2);
  });

  it('temperature 为 0 时合法', () => {
    const result = validateAiConfig({ ...validConfig, temperature: 0 });
    expect(result.temperature).toBe(0);
  });

  it('anthropic providerId 返回正确的 providerMode', () => {
    const result = validateAiConfig({
      ...validConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
    });
    expect(result.providerMode).toBe('anthropic');
  });

  it('openai-compatible providerType 返回正确的 providerMode', () => {
    const result = validateAiConfig(validConfig);
    expect(result.providerMode).toBe('openai-compatible');
  });

  it('apiKey 超过 300 字符时被截断', () => {
    const longKey = 'a'.repeat(400);
    const result = validateAiConfig({ ...validConfig, apiKey: longKey });
    expect(result.apiKey.length).toBe(300);
  });

  it('model 超过 120 字符时被截断', () => {
    const longModel = 'a'.repeat(200);
    const result = validateAiConfig({ ...validConfig, model: longModel });
    expect(result.model.length).toBe(120);
  });
});

// ================================================================
// validateAiConfig — SSRF 防护
// ================================================================

describe('validateAiConfig SSRF 防护', () => {
  const base = {
    apiKey: 'sk-test12345678',
    model: 'gpt-4o',
    providerId: 'openai',
    providerType: 'openai-compatible',
    temperature: 0.2,
  };

  it('公网 HTTPS URL 正常通过', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'https://api.openai.com/v1' })).not.toThrow();
  });

  it('公网 HTTP URL 正常通过', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://api.example.com/v1' })).not.toThrow();
  });

  it('localhost 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://localhost:11434/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('127.0.0.1 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://127.0.0.1:8080/v1' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('192.168.x.x 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://192.168.1.100/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('10.x.x.x 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://10.0.0.1/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('172.16-31 私有网络被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://172.16.0.1/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('AWS 元数据端点 169.254.169.254 被拒绝', () => {
    expect(() =>
      validateAiConfig({ ...base, baseUrl: 'http://169.254.169.254/latest/meta-data' })
    ).toThrow('不允许指向本地或私有网络');
  });

  it('IPv6 环回地址 ::1 被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'http://[::1]:8080/api' })).toThrow(
      '不允许指向本地或私有网络'
    );
  });

  it('无效 URL 格式被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'not-a-url' })).toThrow('格式无效');
  });

  it('非 http/https 协议被拒绝', () => {
    expect(() => validateAiConfig({ ...base, baseUrl: 'ftp://api.example.com/v1' })).toThrow(
      '仅支持 http 或 https 协议'
    );
  });
});

// ================================================================
// sanitizeRootSuggestions
// ================================================================

describe('sanitizeRootSuggestions', () => {
  it('正常词根通过', () => {
    const items = [{ name: 'spect', meaning: '看' }];
    const result = sanitizeRootSuggestions(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'spect', meaning: '看' });
  });

  it('非数组输入返回空数组', () => {
    expect(sanitizeRootSuggestions(null)).toEqual([]);
    expect(sanitizeRootSuggestions(undefined)).toEqual([]);
    expect(sanitizeRootSuggestions('string')).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(sanitizeRootSuggestions([])).toEqual([]);
  });

  it('名称含非法字符时过滤', () => {
    const items = [
      { name: 'SPEC', meaning: '看' }, // 大写 - 会被转小写后通过
      { name: 'sp3ct', meaning: '看' }, // 含数字 - 过滤
      { name: 'sp ct', meaning: '看' }, // 含空格 - 过滤
      { name: 'sp', meaning: '看' }, // 长度合法
    ];
    const result = sanitizeRootSuggestions(items);
    // SPEC→spec 合法，sp3ct 和 'sp ct' 被过滤，sp 合法
    expect(result.some((r) => r.name === 'spec')).toBe(true);
    expect(result.some((r) => r.name === 'sp')).toBe(true);
    expect(result.some((r) => r.name === 'sp3ct')).toBe(false);
  });

  it('已有名称中的词根被过滤（去重）', () => {
    const items = [{ name: 'spect', meaning: '看' }];
    const result = sanitizeRootSuggestions(items, ['spect']);
    expect(result).toHaveLength(0);
  });

  it('已有名称不区分大小写去重', () => {
    const items = [{ name: 'spect', meaning: '看' }];
    const result = sanitizeRootSuggestions(items, ['SPECT']);
    expect(result).toHaveLength(0);
  });

  it('重复词根只保留第一个', () => {
    const items = [
      { name: 'spect', meaning: '看1' },
      { name: 'spect', meaning: '看2' },
    ];
    const result = sanitizeRootSuggestions(items);
    expect(result).toHaveLength(1);
    expect(result[0].meaning).toBe('看1');
  });

  it('缺少 meaning 时过滤', () => {
    const items = [{ name: 'spect', meaning: '' }];
    expect(sanitizeRootSuggestions(items)).toHaveLength(0);
  });

  it('超过 10 个词根时截断', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      name: `root${(i + 10).toString(36)}`,
      meaning: '测试',
    }));
    const result = sanitizeRootSuggestions(items);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('名称太短时过滤（少于2个字符）', () => {
    const items = [{ name: 's', meaning: '看' }];
    expect(sanitizeRootSuggestions(items)).toHaveLength(0);
  });

  it('名称含连字符合法', () => {
    const items = [{ name: 'semi-', meaning: '半' }];
    const result = sanitizeRootSuggestions(items);
    expect(result).toHaveLength(1);
  });

  it('meaning 过长时被截断', () => {
    const items = [{ name: 'spect', meaning: 'a'.repeat(200) }];
    const result = sanitizeRootSuggestions(items);
    expect(result[0].meaning.length).toBeLessThanOrEqual(80);
  });
});

// ================================================================
// sanitizeWordSuggestions
// ================================================================

describe('sanitizeWordSuggestions', () => {
  const validItem = {
    name: 'inspect',
    meaning: '检查；视察',
    phonetic: '/ɪnˈspekt/',
    partOfSpeech: [{ type: 'v.', meaning: '检查' }],
  };

  it('正常单词通过', () => {
    const result = sanitizeWordSuggestions([validItem]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('inspect');
    expect(result[0].meaning).toBe('检查；视察');
    expect(result[0].phonetic).toBe('/ɪnˈspekt/');
  });

  it('非数组输入返回空数组', () => {
    expect(sanitizeWordSuggestions(null)).toEqual([]);
    expect(sanitizeWordSuggestions(42)).toEqual([]);
  });

  it('缺少 meaning 时过滤', () => {
    const items = [{ ...validItem, meaning: '' }];
    expect(sanitizeWordSuggestions(items)).toHaveLength(0);
  });

  it('已有名称去重（不区分大小写）', () => {
    const result = sanitizeWordSuggestions([validItem], ['INSPECT']);
    expect(result).toHaveLength(0);
  });

  it('词性类型非法时跳过该词性条目', () => {
    const item = {
      ...validItem,
      partOfSpeech: [
        { type: 'x.', meaning: '未知' }, // 非法词性
        { type: 'v.', meaning: '检查' }, // 合法
      ],
    };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toHaveLength(1);
    expect(result[0].partOfSpeech[0].type).toBe('v.');
  });

  it('所有词性类型都非法时 partOfSpeech 为空数组', () => {
    const item = { ...validItem, partOfSpeech: [{ type: 'xx.', meaning: '无效' }] };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toEqual([]);
  });

  it('partOfSpeech 非数组时返回空 partOfSpeech', () => {
    const item = { ...validItem, partOfSpeech: null };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toEqual([]);
  });

  it('超过 12 个单词时截断', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      name: `word${String.fromCharCode(97 + i)}`,
      meaning: '含义',
      phonetic: '',
      partOfSpeech: [],
    }));
    const result = sanitizeWordSuggestions(items);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('单词名称第一个字符不是字母时过滤', () => {
    const item = { ...validItem, name: '1nspect' };
    expect(sanitizeWordSuggestions([item])).toHaveLength(0);
  });

  it('缺少 phonetic 时 phonetic 为空字符串', () => {
    const item = { ...validItem, phonetic: undefined };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].phonetic).toBe('');
  });

  it('词性 meaning 为空时跳过', () => {
    const item = {
      ...validItem,
      partOfSpeech: [{ type: 'v.', meaning: '' }],
    };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toHaveLength(0);
  });

  it('所有合法词性类型均被接受（最多保留 8 条）', () => {
    const validTypes = [
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
    ];
    const item = {
      ...validItem,
      partOfSpeech: validTypes.map((type) => ({ type, meaning: '测试' })),
    };
    const result = sanitizeWordSuggestions([item]);
    // 每种类型合法，但最多保留 8 条
    expect(result[0].partOfSpeech.length).toBe(8);
    expect(result[0].partOfSpeech.every((p) => validTypes.includes(p.type))).toBe(true);
  });
});

// ================================================================
// sanitizeExampleSuggestions
// ================================================================

describe('sanitizeExampleSuggestions', () => {
  const validItem = {
    sentence: 'She inspects the room carefully.',
    translation: '她仔细检查了房间。',
  };

  it('正常例句通过', () => {
    const result = sanitizeExampleSuggestions([validItem]);
    expect(result).toHaveLength(1);
    expect(result[0].sentence).toBe(validItem.sentence);
    expect(result[0].translation).toBe(validItem.translation);
  });

  it('非数组输入返回空数组', () => {
    expect(sanitizeExampleSuggestions(null)).toEqual([]);
    expect(sanitizeExampleSuggestions('text')).toEqual([]);
  });

  it('句子为空时过滤', () => {
    expect(sanitizeExampleSuggestions([{ sentence: '', translation: '翻译' }])).toHaveLength(0);
  });

  it('翻译为空时过滤', () => {
    expect(
      sanitizeExampleSuggestions([{ sentence: validItem.sentence, translation: '' }])
    ).toHaveLength(0);
  });

  it('句子太短（少于 8 字符）时过滤', () => {
    expect(sanitizeExampleSuggestions([{ sentence: 'Short', translation: '翻译' }])).toHaveLength(
      0
    );
  });

  it('已有句子去重（不区分大小写）', () => {
    const result = sanitizeExampleSuggestions([validItem], [validItem.sentence.toUpperCase()]);
    expect(result).toHaveLength(0);
  });

  it('重复例句只保留第一条', () => {
    const items = [validItem, validItem];
    const result = sanitizeExampleSuggestions(items);
    expect(result).toHaveLength(1);
  });

  it('超过 8 条时截断', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      sentence: `This is a test sentence number ${i + 1}.`,
      translation: `翻译 ${i + 1}`,
    }));
    const result = sanitizeExampleSuggestions(items);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('句子过长时被截断至 400 字符', () => {
    const longSentence = 'a'.repeat(500);
    const result = sanitizeExampleSuggestions([{ sentence: longSentence, translation: '翻译' }]);
    // 长度小于8会被过滤，但截断后是 'aaaa...aaa' 依然是400个a，>8, 所以通过
    expect(result[0].sentence.length).toBeLessThanOrEqual(400);
  });

  it('无 existingSentences 参数时不去重', () => {
    const result = sanitizeExampleSuggestions([validItem]);
    expect(result).toHaveLength(1);
  });
});

// ================================================================
// requestAiJson (通过 fetch mock)
// ================================================================

describe('requestAiJson', () => {
  const validConfig = {
    apiKey: 'sk-test12345678',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    providerId: 'openai',
    providerType: 'openai-compatible',
    temperature: 0.2,
  };

  const validPrompts = {
    systemPrompt: '你是助手',
    userPrompt: '请返回JSON',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OpenAI compatible: 成功返回 JSON 对象', async () => {
    const responseBody = { choices: [{ message: { content: '{"message":"ok","items":[]}' } }] };
    fetch.mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    });

    const result = await requestAiJson(validConfig, validPrompts);
    expect(result).toEqual({ message: 'ok', items: [] });
  });

  it('OpenAI compatible: 返回 markdown 代码块中的 JSON', async () => {
    const content = '```json\n{"message":"ok","items":[]}\n```';
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });

    const result = await requestAiJson(validConfig, validPrompts);
    expect(result).toMatchObject({ message: 'ok' });
  });

  it('OpenAI compatible: API 返回错误时抛出', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(requestAiJson(validConfig, validPrompts)).rejects.toThrow('Invalid API key');
  });

  it('OpenAI compatible: AI 返回非 JSON 内容时抛出', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '这不是 JSON' } }] }),
    });

    await expect(requestAiJson(validConfig, validPrompts)).rejects.toThrow('无法解析为 JSON');
  });

  it('OpenAI compatible: 内容为空时抛出', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: null } }] }),
    });

    await expect(requestAiJson(validConfig, validPrompts)).rejects.toThrow('未返回有效内容');
  });

  it('Anthropic: 成功调用并返回 JSON', async () => {
    const anthropicConfig = {
      ...validConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"message":"ok","items":[]}' }],
      }),
    });

    const result = await requestAiJson(anthropicConfig, validPrompts);
    expect(result).toMatchObject({ message: 'ok' });
  });

  it('Anthropic: API 返回错误时抛出', async () => {
    const anthropicConfig = {
      ...validConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Anthropic error' } }),
    });

    await expect(requestAiJson(anthropicConfig, validPrompts)).rejects.toThrow('Anthropic error');
  });

  it('配置不完整时抛出（validateAiConfig 校验）', async () => {
    const badConfig = { ...validConfig, apiKey: '' };
    await expect(requestAiJson(badConfig, validPrompts)).rejects.toThrow('AI 配置不完整');
  });

  it('fetch 网络错误时抛出', async () => {
    fetch.mockRejectedValue(new Error('Network Error'));
    await expect(requestAiJson(validConfig, validPrompts)).rejects.toThrow('Network Error');
  });

  it('content 为数组时能正确拼接', async () => {
    const anthropicConfig = {
      ...validConfig,
      providerId: 'anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: '{"message":' },
          { type: 'text', text: '"ok","items":[]}' },
        ],
      }),
    });

    const result = await requestAiJson(anthropicConfig, validPrompts);
    expect(result.message).toBe('ok');
  });
});
