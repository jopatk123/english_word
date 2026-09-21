import { describe, expect, it } from 'vitest';
import { normalizeLookupWord, parsePartOfSpeech } from '../services/word-lookup.js';

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
    expect(normalizeLookupWord(null)).toBe('');
  });
});

describe('parsePartOfSpeech', () => {
  it('解析 JSON 字符串，非法内容返回空数组', () => {
    expect(parsePartOfSpeech('[{"type":"n.","meaning":"包裹"}]')).toEqual([
      { type: 'n.', meaning: '包裹' },
    ]);
    expect(parsePartOfSpeech('not-json')).toEqual([]);
    expect(parsePartOfSpeech(null)).toEqual([]);
  });
});
