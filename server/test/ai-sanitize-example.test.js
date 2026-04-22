import { describe, expect, it } from 'vitest';
import { sanitizeExampleSuggestions } from '../utils/ai.js';
import { validExampleItem } from './ai-test-utils.js';

describe('sanitizeExampleSuggestions', () => {
  it('正常例句通过', () => {
    const result = sanitizeExampleSuggestions([validExampleItem]);
    expect(result).toHaveLength(1);
    expect(result[0].sentence).toBe(validExampleItem.sentence);
    expect(result[0].translation).toBe(validExampleItem.translation);
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
      sanitizeExampleSuggestions([{ sentence: validExampleItem.sentence, translation: '' }])
    ).toHaveLength(0);
  });

  it('句子太短（少于 8 字符）时过滤', () => {
    expect(sanitizeExampleSuggestions([{ sentence: 'Short', translation: '翻译' }])).toHaveLength(0);
  });

  it('已有句子去重（不区分大小写）', () => {
    const result = sanitizeExampleSuggestions([validExampleItem], [validExampleItem.sentence.toUpperCase()]);
    expect(result).toHaveLength(0);
  });

  it('重复例句只保留第一条', () => {
    const items = [validExampleItem, validExampleItem];
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
    expect(result[0].sentence.length).toBeLessThanOrEqual(400);
  });

  it('无 existingSentences 参数时不去重', () => {
    const result = sanitizeExampleSuggestions([validExampleItem]);
    expect(result).toHaveLength(1);
  });
});