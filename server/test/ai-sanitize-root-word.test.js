import { describe, expect, it } from 'vitest';
import { sanitizeRootSuggestions, sanitizeWordSuggestions } from '../utils/ai.js';
import { validRootItem, validWordItem } from './ai-test-utils.js';

describe('sanitizeRootSuggestions', () => {
  it('正常词根通过', () => {
    const items = [validRootItem];
    const result = sanitizeRootSuggestions(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validRootItem);
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
      { name: 'SPEC', meaning: '看' },
      { name: 'sp3ct', meaning: '看' },
      { name: 'sp ct', meaning: '看' },
      { name: 'sp', meaning: '看' },
    ];
    const result = sanitizeRootSuggestions(items);
    expect(result.some((r) => r.name === 'spec')).toBe(true);
    expect(result.some((r) => r.name === 'sp')).toBe(true);
    expect(result.some((r) => r.name === 'sp3ct')).toBe(false);
  });

  it('已有名称中的词根被过滤（去重）', () => {
    const items = [validRootItem];
    const result = sanitizeRootSuggestions(items, ['spect']);
    expect(result).toHaveLength(0);
  });

  it('已有名称不区分大小写去重', () => {
    const items = [validRootItem];
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

describe('sanitizeWordSuggestions', () => {
  it('正常单词通过', () => {
    const result = sanitizeWordSuggestions([validWordItem]);
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
    const items = [{ ...validWordItem, meaning: '' }];
    expect(sanitizeWordSuggestions(items)).toHaveLength(0);
  });

  it('已有名称去重（不区分大小写）', () => {
    const result = sanitizeWordSuggestions([validWordItem], ['INSPECT']);
    expect(result).toHaveLength(0);
  });

  it('词性类型非法时跳过该词性条目', () => {
    const item = {
      ...validWordItem,
      partOfSpeech: [
        { type: 'x.', meaning: '未知' },
        { type: 'v.', meaning: '检查' },
      ],
    };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toHaveLength(1);
    expect(result[0].partOfSpeech[0].type).toBe('v.');
  });

  it('所有词性类型都非法时 partOfSpeech 为空数组', () => {
    const item = { ...validWordItem, partOfSpeech: [{ type: 'xx.', meaning: '无效' }] };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toEqual([]);
  });

  it('partOfSpeech 非数组时返回空 partOfSpeech', () => {
    const item = { ...validWordItem, partOfSpeech: null };
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
    const item = { ...validWordItem, name: '1nspect' };
    expect(sanitizeWordSuggestions([item])).toHaveLength(0);
  });

  it('缺少 phonetic 时 phonetic 为空字符串', () => {
    const item = { ...validWordItem, phonetic: undefined };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].phonetic).toBe('');
  });

  it('词性 meaning 为空时跳过', () => {
    const item = {
      ...validWordItem,
      partOfSpeech: [{ type: 'v.', meaning: '' }],
    };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech).toHaveLength(0);
  });

  it('所有合法词性类型均被接受（最多保留 8 条）', () => {
    const validTypes = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'interj.', 'num.', 'art.', 'aux.'];
    const item = {
      ...validWordItem,
      partOfSpeech: validTypes.map((type) => ({ type, meaning: '测试' })),
    };
    const result = sanitizeWordSuggestions([item]);
    expect(result[0].partOfSpeech.length).toBe(8);
    expect(result[0].partOfSpeech.every((p) => validTypes.includes(p.type))).toBe(true);
  });
});