import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/index.js', () => ({
  lookupWord: vi.fn(),
  createWord: vi.fn(),
}));

vi.mock('../../utils/aiSettings.js', () => ({
  loadAiSettings: () => ({ providerId: 'openai', model: 'gpt-test' }),
}));

const { lookupWord, createWord } = await import('../../api/index.js');
const { addLookupWordToLibrary, clearWordLookupSession, openWordLookup, wordLookupState } =
  await import('../wordLookup.js');

const anchor = () => ({ isConnected: true });

describe('wordLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWordLookupSession();
  });

  it('查询成功后写入会话缓存，再次点击不再请求', async () => {
    lookupWord.mockResolvedValue({
      data: {
        word: 'parcel',
        phonetic: '/ˈpɑːsl/',
        meaning: '包裹',
        partOfSpeech: [{ type: 'n.', meaning: '包裹' }],
        source: 'ai',
        wordId: null,
      },
    });

    await openWordLookup({
      word: "Parcel's",
      sentence: 'The parcel arrived.',
      anchor: anchor(),
    });
    expect(lookupWord).toHaveBeenCalledWith('parcel', expect.any(Object), {
      sentence: 'The parcel arrived.',
    });
    expect(wordLookupState.result.meaning).toBe('包裹');

    await openWordLookup({ word: 'parcel', sentence: 'Another sentence.', anchor: anchor() });
    expect(lookupWord).toHaveBeenCalledTimes(1);
    expect(wordLookupState.sentence).toBe('Another sentence.');
  });

  it('加入词库后改为词库来源', async () => {
    lookupWord.mockResolvedValue({
      data: {
        word: 'parcel',
        phonetic: '',
        meaning: '包裹',
        partOfSpeech: [],
        source: 'ai',
        wordId: null,
      },
    });
    createWord.mockResolvedValue({ data: { id: 42 } });

    await openWordLookup({ word: 'parcel', anchor: anchor() });
    const saved = await addLookupWordToLibrary();
    expect(createWord).toHaveBeenCalledWith({
      name: 'parcel',
      meaning: '包裹',
      phonetic: '',
    });
    expect(saved.wordId).toBe(42);
    expect(wordLookupState.result.source).toBe('library');
  });

  it('请求失败时保留错误信息', async () => {
    lookupWord.mockRejectedValue({ response: { data: { msg: 'AI 配置不完整' } } });
    await openWordLookup({ word: 'parcel', anchor: anchor() });
    expect(wordLookupState.loading).toBe(false);
    expect(wordLookupState.error).toBe('AI 配置不完整');
    expect(wordLookupState.result).toBeNull();
  });
});
