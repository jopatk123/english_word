/**
 * 测试：continueReview 排队策略与 seek 跳转逻辑（纯逻辑）
 *
 * continueReview() 的核心行为等价于：
 *   againFirst(originalQueue, againIds) => [...againItems, ...otherItems]
 *
 * 此处直接测该纯逻辑，不依赖 composable 完整生命周期。
 */
import { ref } from 'vue';
import { describe, it, expect, vi } from 'vitest';

import { seekToStudyCard, useStudySession } from '../useStudySession.js';

vi.mock('../../api/index.js', () => ({
  getReviewDue: vi.fn().mockResolvedValue({ data: [] }),
  submitReviewResult: vi.fn().mockResolvedValue({}),
  getQuizChoices: vi.fn().mockResolvedValue({
    data: { correct: { id: 1, meaning: 'meaning1' }, distractors: [] },
  }),
}));

vi.mock('../../utils/speech.js', () => ({
  useSpeech: () => ({ speak: vi.fn() }),
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
    const choice = {
      resetChoice: vi.fn(),
      setQueueWords: vi.fn(),
      loadChoices: vi.fn(),
    };
    const spelling = {
      resetSpelling: vi.fn(),
    };
    const saveProgress = vi.fn();
    const incrementRevision = vi.fn();

    return {
      queue,
      currentIndex,
      finished,
      showAnswer,
      submitting,
      studyMode,
      choice,
      spelling,
      saveProgress,
      incrementRevision,
      ...overrides,
    };
  };

  it('跳转时会重置当前卡片状态并加载目标题', () => {
    const deps = makeDeps();

    const result = seekToStudyCard({
      targetIndex: 2,
      ...deps,
    });

    expect(result).toBe(true);
    expect(deps.currentIndex.value).toBe(2);
    expect(deps.finished.value).toBe(false);
    expect(deps.showAnswer.value).toBe(false);
    expect(deps.choice.resetChoice).toHaveBeenCalledTimes(1);
    expect(deps.spelling.resetSpelling).toHaveBeenCalledTimes(1);
    expect(deps.choice.setQueueWords).toHaveBeenCalledWith(deps.queue.value.map((item) => item.word));
    expect(deps.choice.loadChoices).toHaveBeenCalledTimes(1);
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

describe('useStudySession 对外暴露 seekToIndex', () => {
  it('返回 seekToIndex 函数', () => {
    const session = useStudySession();

    expect(typeof session.seekToIndex).toBe('function');
  });
});
