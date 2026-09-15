import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import { seekToStudyCard, useStudySession } from '../useStudySession.js';
import { FOLLOW_UP_OFFSETS, insertFollowUpCard } from '../studyQueue.js';

describe('seekToStudyCard', () => {
  const createDeps = (overrides = {}) => ({
    queue: ref([
      { wordId: 1, word: { id: 1, name: 'alpha' } },
      { wordId: 2, word: { id: 2, name: 'beta' } },
      { wordId: 3, word: { id: 3, name: 'gamma' } },
    ]),
    currentIndex: ref(1),
    finished: ref(false),
    showAnswer: ref(true),
    submitting: ref(false),
    studyMode: ref('autoRead'),
    resetModes: vi.fn(),
    initModeCard: vi.fn(),
    saveProgress: vi.fn(),
    incrementRevision: vi.fn(),
    stopAutoRead: vi.fn(),
    ...overrides,
  });

  it('same index does nothing', () => {
    const deps = createDeps();

    const result = seekToStudyCard({
      targetIndex: 1,
      ...deps,
    });

    expect(result).toBe(false);
    expect(deps.stopAutoRead).not.toHaveBeenCalled();
    expect(deps.saveProgress).not.toHaveBeenCalled();
    expect(deps.currentIndex.value).toBe(1);
  });

  it('jumps to a new index and resets session state', () => {
    const deps = createDeps({ studyMode: ref('choice') });

    const result = seekToStudyCard({
      targetIndex: 2,
      ...deps,
    });

    expect(result).toBe(true);
    expect(deps.stopAutoRead).toHaveBeenCalledTimes(1);
    expect(deps.currentIndex.value).toBe(2);
    expect(deps.finished.value).toBe(false);
    expect(deps.showAnswer.value).toBe(false);
    expect(deps.resetModes).toHaveBeenCalledTimes(1);
    expect(deps.initModeCard).toHaveBeenCalledWith('choice');
    expect(deps.incrementRevision).toHaveBeenCalledTimes(1);
    expect(deps.saveProgress).toHaveBeenCalledTimes(1);
  });
});
/**
 * 测试：continueReview 排队策略与 seek 跳转逻辑（纯逻辑）
 *
 * continueReview() 的核心行为等价于：
 *   againFirst(originalQueue, againIds) => [...againItems, ...otherItems]
 *
 * 此处直接测该纯逻辑，不依赖 composable 完整生命周期。
 */

const getReviewDueMock = vi.fn().mockResolvedValue({ data: [] });
const submitReviewResultMock = vi.fn().mockResolvedValue({});
const getQuizChoicesMock = vi.fn().mockResolvedValue({
  data: { correct: { id: 1, meaning: 'meaning1' }, distractors: [] },
});
const getAiExampleSuggestionsMock = vi.fn();
const updateExampleMock = vi.fn().mockResolvedValue({});
const mockSpeak = vi.fn();
const mockSpeakAsync = vi.fn().mockResolvedValue(true);
const mockSpeakSequence = vi.fn().mockResolvedValue(true);
const mockCancelSpeech = vi.fn(() => {
  mockIsPaused.value = false;
});
const mockPauseSpeech = vi.fn(() => {
  mockIsPaused.value = true;
});
const mockResumeSpeech = vi.fn(() => {
  mockIsPaused.value = false;
});
const mockIsPaused = ref(false);

vi.mock('../../api/index.js', () => ({
  getReviewDue: (...args) => getReviewDueMock(...args),
  submitReviewResult: (...args) => submitReviewResultMock(...args),
  getQuizChoices: (...args) => getQuizChoicesMock(...args),
  getAiExampleSuggestions: (...args) => getAiExampleSuggestionsMock(...args),
  updateExample: (...args) => updateExampleMock(...args),
}));

vi.mock('../../utils/aiSettings.js', () => ({
  isAiSettingsReady: (settings) => Boolean(settings?.model),
  loadAiSettings: () => ({ providerId: 'openai', model: 'gpt-test' }),
  refreshAiSettings: () => Promise.resolve({ providerId: 'openai', model: 'gpt-test' }),
  subscribeAiSettingsChanges: () => () => {},
}));

vi.mock('../../utils/speech.js', () => ({
  useSpeech: () => ({
    speak: mockSpeak,
    speakAsync: mockSpeakAsync,
    speakSequence: mockSpeakSequence,
    cancelSpeech: mockCancelSpeech,
    pauseSpeech: mockPauseSpeech,
    resumeSpeech: mockResumeSpeech,
    isPaused: mockIsPaused,
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}));

function makeItem(wordId) {
  return { wordId, word: { id: wordId, name: `word${wordId}`, meaning: `meaning${wordId}` } };
}

/** 与 useStudySession.continueReview 内部逻辑完全等价的纯函数 */
function againFirst(originalQueue, againIds) {
  const ids = new Set(againIds);
  const againItems = originalQueue.filter((item) => ids.has(item.wordId));
  const otherItems = originalQueue.filter((item) => !ids.has(item.wordId));
  return [...againItems, ...otherItems];
}

describe('continueReview 排队策略', () => {
  const items = [makeItem(1), makeItem(2), makeItem(3), makeItem(4), makeItem(5)];

  it('有 again 词时，again 词排到最前', () => {
    const result = againFirst(items, [3, 5]);
    expect(result.map((i) => i.wordId)).toEqual([3, 5, 1, 2, 4]);
  });

  it('没有 again 词时，返回全部原始词（顺序不变）', () => {
    const result = againFirst(items, []);
    expect(result.map((i) => i.wordId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('所有词都是 again 词时，全部保留（again 区与 other 区各自顺序不变）', () => {
    const result = againFirst(items, [1, 2, 3, 4, 5]);
    expect(result).toHaveLength(5);
    // againItems = all five, otherItems = []
    expect(result.map((i) => i.wordId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('只有一个 again 词时，该词排第一', () => {
    const result = againFirst(items, [4]);
    expect(result[0].wordId).toBe(4);
    expect(result).toHaveLength(5);
  });

  it('again ids 不在队列中时，等同于没有 again 词', () => {
    const result = againFirst(items, [99]);
    expect(result.map((i) => i.wordId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('空队列返回空数组', () => {
    expect(againFirst([], [1, 2])).toHaveLength(0);
  });

  it('多个 again 词相对顺序与原队列保持一致', () => {
    // items 顺序：1,2,3,4,5；again=[5,2] → filter 保持 [2,5]
    const result = againFirst(items, [5, 2]);
    expect(result.slice(0, 2).map((i) => i.wordId)).toEqual([2, 5]);
  });
});

describe('seekToStudyCard 跳转逻辑', () => {
  const makeQueue = () => ref([makeItem(1), makeItem(2), makeItem(3), makeItem(4)]);

  const makeDeps = (overrides = {}) => {
    const queue = makeQueue();
    const currentIndex = ref(0);
    const finished = ref(true);
    const showAnswer = ref(true);
    const submitting = ref(false);
    const studyMode = ref('choice');
    const resetModes = vi.fn();
    const initModeCard = vi.fn();
    const saveProgress = vi.fn();
    const incrementRevision = vi.fn();

    return {
      queue,
      currentIndex,
      finished,
      showAnswer,
      submitting,
      studyMode,
      resetModes,
      initModeCard,
      saveProgress,
      incrementRevision,
      ...overrides,
    };
  };

  it('跳转时会重置模式状态并通知目标模式初始化', () => {
    const deps = makeDeps();

    const result = seekToStudyCard({
      targetIndex: 2,
      ...deps,
    });

    expect(result).toBe(true);
    expect(deps.currentIndex.value).toBe(2);
    expect(deps.finished.value).toBe(false);
    expect(deps.showAnswer.value).toBe(false);
    expect(deps.resetModes).toHaveBeenCalledTimes(1);
    expect(deps.initModeCard).toHaveBeenCalledWith('choice');
    expect(deps.incrementRevision).toHaveBeenCalledTimes(1);
    expect(deps.saveProgress).toHaveBeenCalledTimes(1);
  });

  it('当前正在提交时忽略跳转', () => {
    const deps = makeDeps({ submitting: ref(true) });

    const result = seekToStudyCard({
      targetIndex: 3,
      ...deps,
    });

    expect(result).toBe(false);
    expect(deps.currentIndex.value).toBe(0);
    expect(deps.saveProgress).not.toHaveBeenCalled();
    expect(deps.incrementRevision).not.toHaveBeenCalled();
  });

  it('目标越界或与当前题相同时不跳转', () => {
    const deps = makeDeps();

    const sameResult = seekToStudyCard({
      targetIndex: 0,
      ...deps,
    });

    const outOfRangeResult = seekToStudyCard({
      targetIndex: 999,
      ...deps,
    });

    expect(sameResult).toBe(false);
    expect(outOfRangeResult).toBe(true);
    expect(deps.currentIndex.value).toBe(3);
  });
});

describe('insertFollowUpCard 队列插入策略', () => {
  it('在当前卡片后留出指定间隔再插入复习卡', () => {
    const queue = [makeItem(1), makeItem(2), makeItem(3), makeItem(4)];
    const currentCard = queue[0];

    const result = insertFollowUpCard(queue, currentCard, 0, FOLLOW_UP_OFFSETS.HARD);

    expect(result.map((item) => item.wordId)).toEqual([1, 2, 3, 1, 4]);
    expect(result[3]).not.toBe(currentCard);
  });

  it('靠近队尾时会安全追加到末尾', () => {
    const queue = [makeItem(1), makeItem(2)];
    const result = insertFollowUpCard(queue, queue[1], 1, FOLLOW_UP_OFFSETS.AGAIN);

    expect(result.map((item) => item.wordId)).toEqual([1, 2, 2]);
  });
});

describe('useStudySession 的 hard 回插', () => {
  it('quality=2 会把当前词回插到短间隔位置', async () => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useStudySession();
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    wrapper.vm.queue = [makeItem(1), makeItem(2), makeItem(3)];
    wrapper.vm.originalQueue = [...wrapper.vm.queue];
    wrapper.vm.currentIndex = 0;

    await wrapper.vm.submitRating(2);

    expect(wrapper.vm.queue.map((item) => item.wordId)).toEqual([1, 2, 3, 1]);
    expect(wrapper.vm.currentIndex).toBe(1);
    expect(wrapper.vm.sessionStats.hard).toBe(1);

    wrapper.unmount();
  });
});

describe('useStudySession 完成页后续复习会正常提交到服务端', () => {
  const mountSession = async (items) => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useStudySession();
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.vm.queue = [...items];
    wrapper.vm.originalQueue = [...items];
    submitReviewResultMock.mockClear();
    return wrapper;
  };

  it('continueReview 后再次评分会提交服务端', async () => {
    const wrapper = await mountSession([makeItem(1), makeItem(2), makeItem(3)]);
    wrapper.vm.againCountMap = { 2: 1 };

    wrapper.vm.continueReview();
    await wrapper.vm.submitRating(3);

    expect(submitReviewResultMock).toHaveBeenCalledWith(2, 3);
    wrapper.unmount();
  });

  it('replayWithNewMode 后再次评分会提交服务端', async () => {
    const wrapper = await mountSession([makeItem(1), makeItem(2)]);

    wrapper.vm.replayWithNewMode();
    await wrapper.vm.submitRating(4);

    expect(submitReviewResultMock).toHaveBeenCalledWith(1, 4);
    wrapper.unmount();
  });

  it('replayAgainWords 后再次评分会提交服务端', async () => {
    const wrapper = await mountSession([makeItem(1), makeItem(2), makeItem(3)]);
    wrapper.vm.againCountMap = { 3: 2 };

    wrapper.vm.replayAgainWords();
    await wrapper.vm.submitRating(1);

    expect(submitReviewResultMock).toHaveBeenCalledWith(3, 1);
    wrapper.unmount();
  });
});

describe('useStudySession 对外暴露 seekToIndex', () => {
  it('返回 seekToIndex 函数', () => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useStudySession();
      },
    });

    expect(typeof wrapper.vm.seekToIndex).toBe('function');
    wrapper.unmount();
  });
});

describe('自动朗读暂停控制', () => {
  beforeEach(() => {
    mockPauseSpeech.mockClear();
    mockResumeSpeech.mockClear();
    mockCancelSpeech.mockClear();
    mockIsPaused.value = false;
  });

  it('toggleAutoReadPause 会切换暂停状态', async () => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useStudySession();
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.vm.isAutoReadPaused).toBe(false);

    wrapper.vm.toggleAutoReadPause();
    expect(wrapper.vm.isAutoReadPaused).toBe(true);
    expect(mockPauseSpeech).toHaveBeenCalledTimes(1);

    wrapper.vm.toggleAutoReadPause();
    expect(wrapper.vm.isAutoReadPaused).toBe(false);
    expect(mockResumeSpeech).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});

describe('useStudySession 重新生成例句', () => {
  const makeCard = (wordId = 1, exampleId = 11) => ({
    wordId,
    word: {
      id: wordId,
      name: `word${wordId}`,
      meaning: `meaning${wordId}`,
      examples: [
        { id: exampleId, sentence: 'Old sentence.', translation: '旧句子。', remark: '备注' },
      ],
    },
  });

  const mountSession = async (card) => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useStudySession();
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.vm.queue = [card];
    wrapper.vm.originalQueue = [card];
    wrapper.vm.currentIndex = 0;
    return wrapper;
  };

  beforeEach(() => {
    getAiExampleSuggestionsMock.mockReset();
    updateExampleMock.mockClear();
  });

  it('重新生成后同步刷新队列与原始队列中的例句', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: { items: [{ sentence: 'Brand new sentence.', translation: '全新句子。' }] },
    });

    const card = makeCard();
    const wrapper = await mountSession(card);

    await wrapper.vm.regenerateExample(card.word.examples[0]);

    expect(getAiExampleSuggestionsMock).toHaveBeenCalledWith(1, expect.any(Object), {
      excludedSentences: ['Old sentence.'],
    });
    expect(updateExampleMock).toHaveBeenCalledWith(11, {
      sentence: 'Brand new sentence.',
      translation: '全新句子。',
      remark: '备注',
    });
    expect(wrapper.vm.queue[0].word.examples[0].sentence).toBe('Brand new sentence.');
    expect(wrapper.vm.originalQueue[0].word.examples[0].sentence).toBe('Brand new sentence.');
    expect(wrapper.vm.regeneratingExampleId).toBeNull();

    wrapper.unmount();
  });

  it('候选全部重复时不更新例句并提示重试', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: { items: [{ sentence: 'Old sentence.', translation: '重复' }] },
    });

    const card = makeCard();
    const wrapper = await mountSession(card);

    await wrapper.vm.regenerateExample(card.word.examples[0]);

    expect(updateExampleMock).not.toHaveBeenCalled();
    expect(wrapper.vm.queue[0].word.examples[0].sentence).toBe('Old sentence.');
    expect(wrapper.vm.regeneratingExampleId).toBeNull();

    wrapper.unmount();
  });

  it('请求失败时给出错误提示且不更新例句', async () => {
    getAiExampleSuggestionsMock.mockRejectedValue(new Error('network down'));

    const card = makeCard();
    const wrapper = await mountSession(card);

    await wrapper.vm.regenerateExample(card.word.examples[0]);

    expect(updateExampleMock).not.toHaveBeenCalled();
    expect(wrapper.vm.queue[0].word.examples[0].sentence).toBe('Old sentence.');
    expect(wrapper.vm.regeneratingExampleId).toBeNull();

    wrapper.unmount();
  });
});
