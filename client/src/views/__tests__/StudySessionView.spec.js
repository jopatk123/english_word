import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudySessionView from '../StudySessionView.vue';
import { globalStubs } from '../../components/study/__tests__/studyTestUtils';

/**
 * 只验证 StudySessionView 与 FlashcardMode 之间的接线：
 * 重新生成的状态与事件是否正确透传（业务逻辑由 composable 自身测试覆盖）。
 */

const regenerateExampleMock = vi.fn();

vi.mock('../../composables/useStudySession.js', () => ({
  useStudySession: () => buildSessionState(),
}));

function makeCard() {
  return {
    wordId: 1,
    word: {
      id: 1,
      name: 'threshold',
      phonetic: '/ˈθreʃhəʊld/',
      meaning: 'n.门槛',
      roots: [],
      examples: [{ id: 11, sentence: 'She crossed the threshold.', translation: '她跨过门槛。' }],
    },
  };
}

function buildSessionState() {
  const card = makeCard();
  return {
    loading: false,
    queue: [card],
    currentCard: card,
    currentIndex: 0,
    showAnswer: true,
    submitting: false,
    finished: false,
    modeSelected: true,
    studyMode: 'flashcard',
    againCountMap: {},
    regeneratingExampleId: 11,
    sessionStats: { total: 0, again: 0, hard: 0, good: 0, easy: 0 },
    hasAgainWords: false,
    againWordCount: 0,
    originalQueueLength: 1,
    resumeInfo: null,
    modeNames: { flashcard: '闪卡' },
    choiceOptions: [],
    choiceSelected: null,
    choiceAnswered: false,
    spellingInput: '',
    spellingAnswered: false,
    spellingCorrect: false,
    spellingHard: false,
    spellingHint: '',
    spellingHintLevel: 0,
    isAutoReadPaused: false,
    regenerateExample: (...args) => regenerateExampleMock(...args),
  };
}

describe('StudySessionView 例句重新生成接线', () => {
  beforeEach(() => {
    regenerateExampleMock.mockClear();
  });

  const createWrapper = () =>
    mount(StudySessionView, {
      global: {
        directives: { loading: {} },
        stubs: {
          ...globalStubs,
          WordImage: { template: '<div class="word-image-stub" />' },
          'el-breadcrumb': { template: '<nav><slot /></nav>' },
          'el-breadcrumb-item': { template: '<span><slot /></span>' },
        },
      },
    });

  it('把 regeneratingExampleId 透传给闪卡模式', () => {
    const wrapper = createWrapper();

    expect(wrapper.find('.example-regenerate').attributes('data-loading')).toBe('true');
  });

  it('转发闪卡模式抛出的 regenerate-example 事件', async () => {
    const wrapper = createWrapper();

    await wrapper.find('.example-regenerate').trigger('click');

    expect(regenerateExampleMock).toHaveBeenCalledTimes(1);
    expect(regenerateExampleMock.mock.calls[0][0]).toMatchObject({ id: 11 });
  });
});
