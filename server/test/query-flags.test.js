import { describe, expect, it } from 'vitest';
import { clampInt, parseOptionalBool, parseOptionalInt } from '../utils/queryFlags.js';
import { sentenceHasLemma } from '../utils/vocabFilters.js';

describe('queryFlags', () => {
  it('解析可选整数', () => {
    expect(parseOptionalInt('12')).toBe(12);
    expect(parseOptionalInt('')).toBeUndefined();
    expect(parseOptionalInt('x')).toBeUndefined();
  });

  it('解析可选布尔', () => {
    expect(parseOptionalBool('1')).toBe(true);
    expect(parseOptionalBool('0')).toBe(false);
    expect(parseOptionalBool('yes')).toBe(true);
    expect(parseOptionalBool('nope')).toBeUndefined();
  });

  it('clampInt 限制范围', () => {
    expect(clampInt(99, { min: 1, max: 20, fallback: 10 })).toBe(20);
    expect(clampInt(NaN, { min: 1, max: 20, fallback: 10 })).toBe(10);
  });
});

describe('sentenceHasLemma', () => {
  it('按词边界忽略大小写匹配', () => {
    expect(sentenceHasLemma('The cats sat.', 'cat')).toBe(false);
    expect(sentenceHasLemma('The cat sat.', 'Cat')).toBe(true);
  });
});
