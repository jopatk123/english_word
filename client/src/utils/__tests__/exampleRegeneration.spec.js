import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectExcludedSentences, requestReplacementExample } from '../exampleRegeneration.js';

const getAiExampleSuggestionsMock = vi.fn();

vi.mock('../../api/index.js', () => ({
  getAiExampleSuggestions: (...args) => getAiExampleSuggestionsMock(...args),
}));

describe('collectExcludedSentences', () => {
  it('合并多个来源并去重，保持首次出现顺序', () => {
    expect(collectExcludedSentences(['a', 'b'], ['b', 'c'], [undefined, ''])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('无有效句子时返回空数组', () => {
    expect(collectExcludedSentences([null, undefined, ''])).toEqual([]);
  });
});

describe('requestReplacementExample', () => {
  const config = { providerId: 'openai', model: 'gpt-test' };

  beforeEach(() => {
    getAiExampleSuggestionsMock.mockReset();
  });

  it('返回第一条与现有例句不重复的候选', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: {
        items: [
          { sentence: 'The table is stable.', translation: '这张桌子很稳。' },
          { sentence: 'Prices remained stable.', translation: '价格保持稳定。' },
        ],
      },
    });

    const result = await requestReplacementExample({
      wordId: 1,
      existingSentences: ['The table is stable.'],
      config,
    });

    expect(result).toEqual({ sentence: 'Prices remained stable.', translation: '价格保持稳定。' });
    expect(getAiExampleSuggestionsMock).toHaveBeenCalledWith(1, config, {
      excludedSentences: ['The table is stable.'],
    });
  });

  it('忽略大小写与首尾空白差异判定重复', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: {
        items: [
          { sentence: '  the TABLE is stable. ', translation: '重复' },
          { sentence: 'A brand new sentence.', translation: '新句子。' },
        ],
      },
    });

    const result = await requestReplacementExample({
      wordId: 1,
      existingSentences: ['The table is stable.'],
      config,
    });

    expect(result).toEqual({ sentence: 'A brand new sentence.', translation: '新句子。' });
  });

  it('首轮候选全部重复时会带着新候选重试一次', async () => {
    getAiExampleSuggestionsMock
      .mockResolvedValueOnce({
        data: { items: [{ sentence: 'The table is stable.', translation: '重复' }] },
      })
      .mockResolvedValueOnce({
        data: { items: [{ sentence: 'A brand new sentence.', translation: '新句子。' }] },
      });

    const result = await requestReplacementExample({
      wordId: 1,
      existingSentences: ['The table is stable.'],
      config,
    });

    expect(result).toEqual({ sentence: 'A brand new sentence.', translation: '新句子。' });
    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(2);
    expect(getAiExampleSuggestionsMock).toHaveBeenNthCalledWith(2, 1, config, {
      excludedSentences: ['The table is stable.'],
    });
  });

  it('始终拿不到不重复候选时返回 null', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: { items: [{ sentence: 'The table is stable.', translation: '重复' }] },
    });

    const result = await requestReplacementExample({
      wordId: 1,
      existingSentences: ['The table is stable.'],
      config,
    });

    expect(result).toBeNull();
    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(2);
  });

  it('缺少翻译的候选会被跳过', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: {
        items: [
          { sentence: 'No translation here.' },
          { sentence: 'Valid one.', translation: '有效。' },
        ],
      },
    });

    const result = await requestReplacementExample({ wordId: 1, config });

    expect(result).toEqual({ sentence: 'Valid one.', translation: '有效。' });
  });
});
