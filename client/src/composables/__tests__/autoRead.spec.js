import { describe, it, expect } from 'vitest';
import { buildAutoReadTexts } from '../useStudySession.js';

describe('buildAutoReadTexts', () => {
  it('returns the word twice and all example sentences in order', () => {
    const card = {
      word: {
        name: 'acquire',
        examples: [
          { sentence: 'We acquired new skills.' },
          { sentence: 'They acquired the company.' },
          { sentence: '  ' },
        ],
      },
    };

    expect(buildAutoReadTexts(card)).toEqual([
      'acquire',
      'acquire',
      'We acquired new skills.',
      'They acquired the company.',
    ]);
  });

  it('skips empty word and empty examples safely', () => {
    expect(
      buildAutoReadTexts({
        word: {
          name: '   ',
          examples: [{ sentence: '' }, { sentence: null }],
        },
      })
    ).toEqual([]);
  });
});