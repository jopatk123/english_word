import { describe, expect, it } from 'vitest';
import { normalizeLookupWord, tokenizeSentence } from '../sentenceTokens.js';

describe('normalizeLookupWord', () => {
  it('规范大小写、弯引号和所有格', () => {
    expect(normalizeLookupWord('  Well-Known ')).toBe('well-known');
    expect(normalizeLookupWord('Year’s')).toBe('year');
    expect(normalizeLookupWord("don't")).toBe("don't");
    expect(normalizeLookupWord("it's")).toBe('it');
  });

  it('拒绝非英文词', () => {
    expect(normalizeLookupWord('123')).toBe('');
    expect(normalizeLookupWord('你好')).toBe('');
    expect(normalizeLookupWord('')).toBe('');
  });
});

describe('tokenizeSentence', () => {
  it('保留标点和空格，并把可查询单词分开', () => {
    expect(tokenizeSentence('She inspects the well-known room.')).toEqual([
      { text: 'She', word: 'she' },
      { text: ' ', word: '' },
      { text: 'inspects', word: 'inspects' },
      { text: ' ', word: '' },
      { text: 'the', word: 'the' },
      { text: ' ', word: '' },
      { text: 'well-known', word: 'well-known' },
      { text: ' ', word: '' },
      { text: 'room', word: 'room' },
      { text: '.', word: '' },
    ]);
  });

  it('空文本返回空数组', () => {
    expect(tokenizeSentence('')).toEqual([]);
    expect(tokenizeSentence(null)).toEqual([]);
  });
});
