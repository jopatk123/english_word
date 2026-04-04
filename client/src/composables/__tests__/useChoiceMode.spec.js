/**
 * 测试：useChoiceMode
 *   - 答题后自动朗读（建议 A）
 *   - 答对评分 quality=3，答错评分 quality=1
 *   - 重置状态
 */
import { ref, computed } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────
const mockSpeak = vi.fn();
vi.mock('../../utils/speech.js', () => ({
  useSpeech: () => ({ speak: mockSpeak }),
}));

const mockSubmitReviewResult = vi.fn().mockResolvedValue({});
vi.mock('../../api/index.js', () => ({
  submitReviewResult: (...args) => mockSubmitReviewResult(...args),
  getQuizChoices: vi.fn().mockResolvedValue({
    data: {
      correct: { id: 1, name: 'transport', meaning: '运输' },
      distractors: [
        { id: 2, meaning: '检查' },
        { id: 3, meaning: '分析' },
        { id: 4, meaning: '创造' },
      ],
    },
  }),
}));

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}));

const { useChoiceMode } = await import('../useChoiceMode.js');

// ── 工具函数 ────────────────────────────────────────────────────
function makeCard(id = 1, name = 'transport') {
  return computed(() => ({
    wordId: id,
    word: { id, name, meaning: '运输' },
  }));
}

function makeOptions(correctId = 1) {
  return [
    { id: correctId, meaning: '运输' },
    { id: 2, meaning: '检查' },
    { id: 3, meaning: '分析' },
    { id: 4, meaning: '创造' },
  ];
}

function makeSetup() {
  const currentCard = makeCard();
  const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const handleAgain = vi.fn();
  const advanceCard = vi.fn();
  const isReplay = ref(false);

  const mode = useChoiceMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay });
  // 模拟已加载的选项（index 0 = 正确）
  mode.choiceOptions.value = makeOptions(1);
  return { mode, sessionStats, handleAgain, advanceCard };
}

// ── 自动朗读 ────────────────────────────────────────────────────

describe('handleChoice 自动朗读', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('答对后调用 speak', async () => {
    const { mode } = makeSetup();
    await mode.handleChoice(0); // index 0 = id:1 = 正确
    expect(mockSpeak).toHaveBeenCalledWith('transport');
  });

  it('答错后也调用 speak', async () => {
    const { mode } = makeSetup();
    await mode.handleChoice(1); // index 1 = id:2 = 错误
    expect(mockSpeak).toHaveBeenCalledWith('transport');
  });
});

// ── 评分 ────────────────────────────────────────────────────────

describe('handleChoice 评分与统计', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('答对：quality=3，good+1，choiceAnswered=true', async () => {
    const { mode, sessionStats } = makeSetup();
    await mode.handleChoice(0);

    expect(mode.choiceAnswered.value).toBe(true);
    expect(mode.choiceSelected.value).toBe(0);
    expect(mockSubmitReviewResult).toHaveBeenCalledWith(1, 3);
    expect(sessionStats.value.good).toBe(1);
    expect(sessionStats.value.again).toBe(0);
  });

  it('答错：quality=1，again+1，handleAgain 被调用', async () => {
    const { mode, sessionStats, handleAgain } = makeSetup();
    await mode.handleChoice(1); // 错误选项

    expect(mockSubmitReviewResult).toHaveBeenCalledWith(1, 1);
    expect(sessionStats.value.again).toBe(1);
    expect(handleAgain).toHaveBeenCalledWith(1);
  });
});

// ── 重置 ─────────────────────────────────────────────────────────

describe('choiceNext / resetChoice', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('choiceNext 重置状态并推进', async () => {
    const { mode, advanceCard } = makeSetup();
    await mode.handleChoice(0);
    mode.choiceNext();

    expect(mode.choiceSelected.value).toBe(-1);
    expect(mode.choiceAnswered.value).toBe(false);
    expect(advanceCard).toHaveBeenCalled();
  });

  it('resetChoice 重置状态', async () => {
    const { mode } = makeSetup();
    await mode.handleChoice(0);
    mode.resetChoice();

    expect(mode.choiceSelected.value).toBe(-1);
    expect(mode.choiceAnswered.value).toBe(false);
    expect(mode.choiceOptions.value).toHaveLength(0);
  });
});

// ── 重播模式 ─────────────────────────────────────────────────────

describe('isReplay 模式', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('isReplay=true 时不调用 submitReviewResult', async () => {
    const currentCard = makeCard();
    const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
    const isReplay = ref(true);
    const mode = useChoiceMode({
      currentCard,
      sessionStats,
      handleAgain: vi.fn(),
      advanceCard: vi.fn(),
      isReplay,
    });
    mode.choiceOptions.value = makeOptions(1);
    await mode.handleChoice(0);

    expect(mockSubmitReviewResult).not.toHaveBeenCalled();
    expect(sessionStats.value.total).toBe(1);
  });
});
