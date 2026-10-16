import { describe, expect, it } from 'vitest';
import {
  collectLookupCandidates,
  countMissingTranslations,
  groupSentencesByParagraph,
  isTranslationMisaligned,
  lemmaCandidates,
} from '../passageText.js';

describe('passageText', () => {
  it('按段落分组并保持顺序', () => {
    const groups = groupSentencesByParagraph([
      { paragraphIndex: 0, text: 'A.' },
      { paragraphIndex: 0, text: 'B.' },
      { paragraphIndex: 2, text: 'C.' },
    ]);
    expect(groups.map((group) => group.map((sentence) => sentence.text))).toEqual([
      ['A.', 'B.'],
      ['C.'],
    ]);
  });

  it('词形候选覆盖复数、过去式和进行时', () => {
    expect(lemmaCandidates('cats')).toContain('cat');
    expect(lemmaCandidates('stopped')).toContain('stop');
    expect(lemmaCandidates('making')).toContain('make');
    expect(lemmaCandidates('harbor')).toEqual(['harbor']);
  });

  it('收集句子里的词及其原形', () => {
    const words = collectLookupCandidates([{ text: 'The harbors stopped.' }]);
    expect(words).toEqual(expect.arrayContaining(['harbors', 'harbor', 'stopped', 'stop']));
  });

  it('判断译文是否整段落在第一句', () => {
    expect(
      isTranslationMisaligned([
        { translation: '整段' },
        { translation: null },
        { translation: null },
      ])
    ).toBe(true);
    expect(isTranslationMisaligned([{ translation: '一' }, { translation: '二' }])).toBe(false);
    expect(countMissingTranslations([{ translation: '一' }, { translation: null }])).toBe(1);
  });
});
