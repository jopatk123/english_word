/**
 * 测试：aiDebug.js 和 aiPrompts.js 工具模块
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskApiKey,
  createDebugInfo,
  withDuration,
  logAiInfo,
  logAiError,
} from '../utils/aiDebug.js';
import {
  buildRootPrompt,
  buildWordPrompt,
  buildExamplePrompt,
  buildAnalyzeWordPrompt,
  buildAnalyzeSentencePrompt,
  sanitizeAnalyzeWordResult,
  sanitizeAnalyzeSentenceResult,
} from '../utils/aiPrompts.js';

// ================================================================
// aiDebug.js
// ================================================================

describe('maskApiKey', () => {
  it('空字符串返回空字符串', () => {
    expect(maskApiKey('')).toBe('');
    expect(maskApiKey()).toBe('');
  });

  it('长度 <= 8 时完全脱敏', () => {
    expect(maskApiKey('12345678')).toBe('****');
    expect(maskApiKey('abc')).toBe('****');
  });

  it('长度 > 8 时保留首4末4', () => {
    // 'sk-abcdefghijklmn' 首4='sk-a'，末4='klmn'
    const result = maskApiKey('sk-abcdefghijklmn');
    expect(result).toBe('sk-a****klmn');
  });
});

describe('createDebugInfo', () => {
  const fakeReq = { method: 'POST', originalUrl: '/api/ai/test' };
  const fakeConfig = {
    providerId: 'openai',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: 'sk-test1234567890',
  };

  it('包含所有必要字段', () => {
    const startedAt = Date.now();
    const info = createDebugInfo(fakeReq, fakeConfig, startedAt);
    expect(info).toMatchObject({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      method: 'POST',
      path: '/api/ai/test',
      startedAt,
    });
    expect(info.requestId).toMatch(/^\d+-[a-z0-9]{6}$/);
    expect(info.apiKeyMasked).toBe('sk-t****7890');
  });

  it('config 字段缺省时使用空字符串', () => {
    const info = createDebugInfo(fakeReq, {}, Date.now());
    expect(info.providerId).toBe('');
    expect(info.model).toBe('');
    expect(info.apiKeyMasked).toBe('');
  });
});

describe('withDuration', () => {
  it('附加 durationMs 字段（非负整数）', () => {
    const startedAt = Date.now() - 100;
    const debugInfo = { startedAt, requestId: 'x' };
    const result = withDuration(debugInfo);
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
    expect(result.requestId).toBe('x');
    expect(result.startedAt).toBe(startedAt);
  });
});

describe('logAiInfo / logAiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logAiInfo 调用 console.log 并包含消息前缀', () => {
    const debugInfo = { startedAt: Date.now(), requestId: 'r1' };
    logAiInfo('test.start', debugInfo);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[AI] test.start'),
      expect.any(String),
    );
  });

  it('logAiError 调用 console.error 并包含 error 字段', () => {
    const debugInfo = { startedAt: Date.now(), requestId: 'r2' };
    logAiError('test.error', debugInfo, new Error('boom'));
    const call = console.error.mock.calls[0];
    expect(call[0]).toContain('[AI] test.error');
    const payload = JSON.parse(call[1]);
    expect(payload.error).toBe('boom');
  });

  it('logAiError：err 为 null 时 error 字段为 unknown error', () => {
    const debugInfo = { startedAt: Date.now(), requestId: 'r3' };
    logAiError('test.error', debugInfo, null);
    const call = console.error.mock.calls[0];
    const payload = JSON.parse(call[1]);
    expect(payload.error).toBe('unknown error');
  });
});

// ================================================================
// aiPrompts.js — Prompt 构建器
// ================================================================

describe('buildRootPrompt', () => {
  it('无词根时提示语包含"没有任何词根"', () => {
    const { userPrompt } = buildRootPrompt([]);
    expect(userPrompt).toContain('没有任何词根');
    expect(userPrompt).toContain('无');
  });

  it('有词根时列出名称和含义', () => {
    const roots = [
      { name: 'spect', meaning: '看' },
      { name: 'fer', meaning: '带来' },
    ];
    const { userPrompt } = buildRootPrompt(roots);
    expect(userPrompt).toContain('spect: 看');
    expect(userPrompt).toContain('fer: 带来');
    expect(userPrompt).toContain('spect, fer');
  });

  it('返回 systemPrompt 和 userPrompt 字段', () => {
    const prompt = buildRootPrompt([]);
    expect(prompt).toHaveProperty('systemPrompt');
    expect(prompt).toHaveProperty('userPrompt');
  });
});

describe('buildWordPrompt', () => {
  const root = { name: 'spect', meaning: '看' };

  it('无单词时提示语包含"没有任何单词"', () => {
    const { userPrompt } = buildWordPrompt(root, []);
    expect(userPrompt).toContain('没有任何单词');
  });

  it('有单词时排除列表正确', () => {
    const words = [{ name: 'inspect', meaning: '检查' }];
    const { userPrompt } = buildWordPrompt(root, words);
    expect(userPrompt).toContain('inspect');
  });

  it('包含词根信息', () => {
    const { userPrompt } = buildWordPrompt(root, []);
    expect(userPrompt).toContain('spect（看）');
  });
});

describe('buildExamplePrompt', () => {
  const word = { name: 'inspect', meaning: '检查', phonetic: '/ɪnˈspekt/', roots: [] };

  it('无例句时提示语包含"没有任何例句"', () => {
    const { userPrompt } = buildExamplePrompt(word, []);
    expect(userPrompt).toContain('没有任何例句');
  });

  it('有例句时列出已有例句', () => {
    const examples = [{ sentence: 'She inspects the room.' }];
    const { userPrompt } = buildExamplePrompt(word, examples);
    expect(userPrompt).toContain('She inspects the room.');
  });

  it('无词根时展示"无"', () => {
    const { userPrompt } = buildExamplePrompt(word, []);
    expect(userPrompt).toContain('词根：无');
  });

  it('有词根时展示词根信息', () => {
    const wordWithRoots = { ...word, roots: [{ name: 'spect', meaning: '看' }] };
    const { userPrompt } = buildExamplePrompt(wordWithRoots, []);
    expect(userPrompt).toContain('spect（看）');
  });

  it('包含额外避开例句列表', () => {
    const { userPrompt } = buildExamplePrompt(word, [], ['She inspects the room carefully.']);
    expect(userPrompt).toContain('本次额外避开列表');
    expect(userPrompt).toContain('She inspects the room carefully.');
  });
});

describe('buildAnalyzeWordPrompt', () => {
  it('包含分析目标单词', () => {
    const { userPrompt } = buildAnalyzeWordPrompt('inspect');
    expect(userPrompt).toContain('inspect');
  });

  it('JSON 格式示例中含 word 字段占位符', () => {
    const { userPrompt } = buildAnalyzeWordPrompt('run');
    expect(userPrompt).toContain('"word": "run"');
  });

  it('单条例句重生成模式会要求只生成 1 条并避开已生成例句', () => {
    const { userPrompt } = buildAnalyzeWordPrompt('inspect', {
      singleExample: true,
      excludedSentences: ['She inspects the room.'],
    });
    expect(userPrompt).toContain('只生成 1 条日常常用英文例句');
    expect(userPrompt).toContain('She inspects the room.');
  });
});

describe('buildAnalyzeSentencePrompt', () => {
  it('包含目标句子', () => {
    const sentence = 'She reads every day.';
    const { userPrompt } = buildAnalyzeSentencePrompt(sentence);
    expect(userPrompt).toContain(sentence);
  });
});

// ================================================================
// aiPrompts.js — 净化器
// ================================================================

describe('sanitizeAnalyzeWordResult', () => {
  it('正常数据正确映射', () => {
    const parsed = {
      word: 'inspect',
      meaning: '检查；视察',
      phonetic: '/ɪnˈspekt/',
      partOfSpeech: [
        { type: 'v.', meaning: '检查' },
        { type: 'n.', meaning: '视察员' },
      ],
      roots: [{ name: 'spect', meaning: '看' }],
      examples: [
        { sentence: 'She inspects the room.', translation: '她检查房间。' },
      ],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'inspect');
    expect(result.word).toBe('inspect');
    expect(result.meaning).toBe('检查；视察');
    expect(result.partOfSpeech).toHaveLength(2);
    expect(result.roots).toHaveLength(1);
    expect(result.examples).toHaveLength(1);
  });

  it('parsed 为 null 返回 null', () => {
    expect(sanitizeAnalyzeWordResult(null, 'test')).toBeNull();
  });

  it('meaning 为空返回 null', () => {
    const parsed = { word: 'x', meaning: '', phonetic: '', partOfSpeech: [], roots: [], examples: [] };
    expect(sanitizeAnalyzeWordResult(parsed, 'x')).toBeNull();
  });

  it('非法词性类型被过滤', () => {
    const parsed = {
      word: 'run',
      meaning: '跑',
      phonetic: '/rʌn/',
      partOfSpeech: [
        { type: 'INVALID', meaning: '无效词性' },
        { type: 'v.', meaning: '跑步' },
      ],
      roots: [],
      examples: [{ sentence: 'He runs fast.', translation: '他跑得快。' }],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'run');
    expect(result.partOfSpeech).toHaveLength(1);
    expect(result.partOfSpeech[0].type).toBe('v.');
  });

  it('词根名称非法格式被过滤', () => {
    const parsed = {
      word: 'inspect',
      meaning: '检查',
      phonetic: '',
      partOfSpeech: [],
      roots: [
        { name: '123invalid', meaning: '无效' },
        { name: 'spect', meaning: '看' },
      ],
      examples: [{ sentence: 'She inspects it.', translation: '她检查它。' }],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'inspect');
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0].name).toBe('spect');
  });

  it('兼容旧格式 root 单对象', () => {
    const parsed = {
      word: 'inspect',
      meaning: '检查',
      phonetic: '',
      partOfSpeech: [],
      root: { name: 'spect', meaning: '看' },
      examples: [{ sentence: 'She inspects it.', translation: '她检查它。' }],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'inspect');
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0].name).toBe('spect');
  });

  it('partOfSpeech 最多保留 8 条', () => {
    const parsed = {
      word: 'test',
      meaning: '测试',
      phonetic: '',
      partOfSpeech: Array.from({ length: 10 }, (_, i) => ({ type: 'v.', meaning: `含义${i}` })),
      roots: [],
      examples: [{ sentence: 'Test it.', translation: '测试它。' }],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'test');
    expect(result.partOfSpeech).toHaveLength(8);
  });

  it('examples 最多保留 3 条', () => {
    const parsed = {
      word: 'go',
      meaning: '去',
      phonetic: '/ɡoʊ/',
      partOfSpeech: [],
      roots: [],
      examples: Array.from({ length: 5 }, (_, i) => ({
        sentence: `Sentence number ${i + 1} goes here.`,
        translation: `翻译${i}`,
      })),
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'go');
    expect(result.examples).toHaveLength(3);
  });

  it('过短的 example sentence 被过滤（< 5 字符）', () => {
    const parsed = {
      word: 'go',
      meaning: '去',
      phonetic: '',
      partOfSpeech: [],
      roots: [],
      examples: [
        { sentence: 'Hi.', translation: '嗨。' },
        { sentence: 'Go to school every day.', translation: '每天去上学。' },
      ],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'go');
    expect(result.examples).toHaveLength(1);
  });

  it('字段长度超限时被截断', () => {
    const longString = 'x'.repeat(500);
    const parsed = {
      word: longString,
      meaning: longString,
      phonetic: longString,
      partOfSpeech: [],
      roots: [],
      examples: [{ sentence: 'Short enough sentence here.', translation: '翻译。' }],
    };
    const result = sanitizeAnalyzeWordResult(parsed, 'x');
    expect(result.word.length).toBeLessThanOrEqual(60);
    expect(result.meaning.length).toBeLessThanOrEqual(200);
    expect(result.phonetic.length).toBeLessThanOrEqual(80);
  });
});

describe('sanitizeAnalyzeSentenceResult', () => {
  it('正常数据正确映射', () => {
    const parsed = {
      sentence: 'She reads every day.',
      translation: '她每天阅读。',
      grammar: '主谓宾结构',
      vocabulary: [
        { word: 'reads', meaning: '阅读', phonetic: '/riːdz/' },
      ],
    };
    const result = sanitizeAnalyzeSentenceResult(parsed, 'She reads every day.');
    expect(result.sentence).toBe('She reads every day.');
    expect(result.translation).toBe('她每天阅读。');
    expect(result.grammar).toBe('主谓宾结构');
    expect(result.vocabulary).toHaveLength(1);
  });

  it('parsed 为 null 返回 null', () => {
    expect(sanitizeAnalyzeSentenceResult(null, 'test')).toBeNull();
  });

  it('translation 为空返回 null', () => {
    const parsed = { sentence: 'Hello.', translation: '', grammar: '', vocabulary: [] };
    expect(sanitizeAnalyzeSentenceResult(parsed, 'Hello.')).toBeNull();
  });

  it('vocabulary 最多保留 8 条', () => {
    const parsed = {
      sentence: 'Hello world.',
      translation: '你好世界。',
      grammar: '简单句',
      vocabulary: Array.from({ length: 10 }, (_, i) => ({
        word: `word${i}`,
        meaning: `含义${i}`,
        phonetic: '',
      })),
    };
    const result = sanitizeAnalyzeSentenceResult(parsed, 'Hello world.');
    expect(result.vocabulary).toHaveLength(8);
  });

  it('vocabulary 中 word 或 meaning 为空的条目被过滤', () => {
    const parsed = {
      sentence: 'Hello world.',
      translation: '你好世界。',
      grammar: '',
      vocabulary: [
        { word: '', meaning: '含义', phonetic: '' },
        { word: 'hello', meaning: '', phonetic: '' },
        { word: 'world', meaning: '世界', phonetic: '/wɜːrld/' },
      ],
    };
    const result = sanitizeAnalyzeSentenceResult(parsed, 'Hello world.');
    expect(result.vocabulary).toHaveLength(1);
    expect(result.vocabulary[0].word).toBe('world');
  });

  it('sentence 回退到传入的原始句子', () => {
    const parsed = { sentence: '', translation: '翻译', grammar: '', vocabulary: [] };
    const result = sanitizeAnalyzeSentenceResult(parsed, 'Fallback sentence.');
    expect(result.sentence).toBe('Fallback sentence.');
  });
});
