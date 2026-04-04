/**
 * 测试：useSpellingMode
 *   - 提示级别（3 级渐进）
 *   - 模糊评分（完全正确 / 接近正确 / 完全错误）
 *   - 答题后自动朗读
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
}));

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}));

// ── 动态导入（mock 必须在 import 之前声明）──────────────────────
const { useSpellingMode } = await import('../useSpellingMode.js');

// ── 工具函数 ────────────────────────────────────────────────────
function makeCard(name = 'construct') {
  return computed(() => ({
    wordId: 1,
    word: { id: 1, name, meaning: '建造' },
  }));
}

function makeSetup(cardName = 'construct') {
  const currentCard = makeCard(cardName);
  const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const handleAgain = vi.fn();
  const advanceCard = vi.fn();
  const isReplay = ref(false);

  const mode = useSpellingMode({ currentCard, sessionStats, handleAgain, advanceCard, isReplay });
  return { mode, sessionStats, handleAgain, advanceCard };
}

// ── Hint level tests ────────────────────────────────────────────

describe('spellingHint 级别', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('level 0：显示默认占位文字', () => {
    const { mode } = makeSetup('construct');
    expect(mode.spellingHint.value).toBe('输入单词拼写...');
  });

  it('level 1：显示首字母 + 下划线 + 字母数', () => {
    const { mode } = makeSetup('construct');
    mode.showSpellingHint();
    expect(mode.spellingHintLevel.value).toBe(1);
    // construct 9 字母，首字母 c，后面 8 个下划线
    expect(mode.spellingHint.value).toBe('c________ (9个字母)');
  });

  it('level 2：显示前半段', () => {
    const { mode } = makeSetup('construct');
    mode.showSpellingHint();
    mode.showSpellingHint();
    expect(mode.spellingHintLevel.value).toBe(2);
    // construct 9 字母：ceil(9/2)=5 → 'const' + '____'
    expect(mode.spellingHint.value).toBe('const____');
  });

  it('level 3：显示前 2/3', () => {
    const { mode } = makeSetup('construct');
    mode.showSpellingHint();
    mode.showSpellingHint();
    mode.showSpellingHint();
    expect(mode.spellingHintLevel.value).toBe(3);
    // construct 9 字母：ceil(9*2/3)=6 → 'constr' + '___'
    expect(mode.spellingHint.value).toBe('constr___');
  });

  it('超过 3 次提示后级别保持在 3', () => {
    const { mode } = makeSetup('construct');
    mode.showSpellingHint();
    mode.showSpellingHint();
    mode.showSpellingHint();
    mode.showSpellingHint(); // 第4次
    expect(mode.spellingHintLevel.value).toBe(3);
  });
});

// ── checkSpelling 评分与状态 ────────────────────────────────────

describe('checkSpelling 评分', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('完全正确 → quality=3，spellingCorrect=true，spellingHard=false', async () => {
    const { mode, sessionStats } = makeSetup('construct');
    mode.spellingInput.value = 'construct';
    await mode.checkSpelling();

    expect(mode.spellingCorrect.value).toBe(true);
    expect(mode.spellingHard.value).toBe(false);
    expect(mockSubmitReviewResult).toHaveBeenCalledWith(1, 3);
    expect(sessionStats.value.good).toBe(1);
    expect(sessionStats.value.hard).toBe(0);
    expect(sessionStats.value.again).toBe(0);
  });

  it('大小写不敏感：CONSTRUCT 与 construct 视为正确', async () => {
    const { mode } = makeSetup('construct');
    mode.spellingInput.value = 'CONSTRUCT';
    await mode.checkSpelling();
    expect(mode.spellingCorrect.value).toBe(true);
  });

  it('接近正确（1 个字母错误）→ quality=2，spellingHard=true，spellingCorrect=false', async () => {
    // construct → constract（1字母差距，threshold=ceil(9*0.2)=2 → 视为 hard）
    const { mode, sessionStats, handleAgain } = makeSetup('construct');
    mode.spellingInput.value = 'constract';
    await mode.checkSpelling();

    expect(mode.spellingCorrect.value).toBe(false);
    expect(mode.spellingHard.value).toBe(true);
    expect(mockSubmitReviewResult).toHaveBeenCalledWith(1, 2);
    expect(sessionStats.value.hard).toBe(1);
    expect(sessionStats.value.again).toBe(0);
    expect(handleAgain).not.toHaveBeenCalled();
  });

  it('完全错误（多字母差距）→ quality=1，spellingHard=false，handleAgain 被调用', async () => {
    const { mode, sessionStats, handleAgain } = makeSetup('construct');
    mode.spellingInput.value = 'abcdef';
    await mode.checkSpelling();

    expect(mode.spellingCorrect.value).toBe(false);
    expect(mode.spellingHard.value).toBe(false);
    expect(mockSubmitReviewResult).toHaveBeenCalledWith(1, 1);
    expect(sessionStats.value.again).toBe(1);
    expect(handleAgain).toHaveBeenCalledWith(1);
  });

  it('空输入不触发检查', async () => {
    const { mode } = makeSetup('construct');
    mode.spellingInput.value = '   ';
    await mode.checkSpelling();
    expect(mode.spellingAnswered.value).toBe(false);
  });

  it('已答题后再次调用不重复计数', async () => {
    const { mode, sessionStats } = makeSetup('construct');
    mode.spellingInput.value = 'construct';
    await mode.checkSpelling();
    await mode.checkSpelling(); // 重复调用
    expect(sessionStats.value.total).toBe(1);
  });

  it('答题后自动调用 speak', async () => {
    const { mode } = makeSetup('construct');
    mode.spellingInput.value = 'construct';
    await mode.checkSpelling();
    expect(mockSpeak).toHaveBeenCalledWith('construct');
  });

  it('答错后也调用 speak', async () => {
    const { mode } = makeSetup('construct');
    mode.spellingInput.value = 'wrong';
    await mode.checkSpelling();
    expect(mockSpeak).toHaveBeenCalledWith('construct');
  });
});

// ── 短单词的阈值边界 ────────────────────────────────────────────

describe('短单词 Levenshtein 阈值', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('4 字母单词：阈值=1，1字母错误=hard', async () => {
    // "able"(4) → threshold=max(1,ceil(4*0.2))=max(1,1)=1
    const { mode, sessionStats } = makeSetup('able');
    mode.spellingInput.value = 'abld'; // dist=1
    await mode.checkSpelling();
    expect(mode.spellingHard.value).toBe(true);
    expect(sessionStats.value.hard).toBe(1);
  });

  it('4 字母单词：2字母错误=again', async () => {
    const { mode, sessionStats } = makeSetup('able');
    mode.spellingInput.value = 'abxx'; // dist=2
    await mode.checkSpelling();
    expect(mode.spellingHard.value).toBe(false);
    expect(sessionStats.value.again).toBe(1);
  });
});

// ── 重置状态 ─────────────────────────────────────────────────────

describe('spellingNext / resetSpelling', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('spellingNext 重置所有状态并推进', async () => {
    const { mode, advanceCard } = makeSetup('construct');
    mode.spellingInput.value = 'constract';
    await mode.checkSpelling();

    mode.spellingNext();
    expect(mode.spellingInput.value).toBe('');
    expect(mode.spellingAnswered.value).toBe(false);
    expect(mode.spellingCorrect.value).toBe(false);
    expect(mode.spellingHard.value).toBe(false);
    expect(mode.spellingHintLevel.value).toBe(0);
    expect(advanceCard).toHaveBeenCalled();
  });

  it('resetSpelling 重置所有状态', async () => {
    const { mode } = makeSetup('construct');
    mode.spellingInput.value = 'constract';
    await mode.checkSpelling();
    mode.showSpellingHint();

    mode.resetSpelling();
    expect(mode.spellingInput.value).toBe('');
    expect(mode.spellingAnswered.value).toBe(false);
    expect(mode.spellingHard.value).toBe(false);
    expect(mode.spellingHintLevel.value).toBe(0);
  });
});

// ── 重播模式不提交 ─────────────────────────────────────────────

describe('isReplay 模式', () => {
  beforeEach(() => {
    mockSpeak.mockReset();
    mockSubmitReviewResult.mockReset().mockResolvedValue({});
  });

  it('isReplay=true 时不调用 submitReviewResult', async () => {
    const currentCard = makeCard('construct');
    const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
    const isReplay = ref(true);
    const mode = useSpellingMode({
      currentCard,
      sessionStats,
      handleAgain: vi.fn(),
      advanceCard: vi.fn(),
      isReplay,
    });
    mode.spellingInput.value = 'construct';
    await mode.checkSpelling();
    expect(mockSubmitReviewResult).not.toHaveBeenCalled();
    expect(sessionStats.value.total).toBe(1);
  });
});
