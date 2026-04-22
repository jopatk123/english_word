import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStudyKeyboard } from '../useStudyKeyboard.js';

// ── 测试工具 ──────────────────────────────────────────────────

function makeEvent(code, key = code, tag = 'BODY') {
  return {
    code,
    key,
    target: { tagName: tag },
    preventDefault: vi.fn(),
  };
}

function makeDefaultDeps(overrides = {}) {
  const speak = vi.fn();
  const flipCard = vi.fn();
  const submitRating = vi.fn();

  const choice = {
    choiceAnswered: ref(false),
    choiceOptions: ref([
      { id: 1, meaning: 'A' },
      { id: 2, meaning: 'B' },
      { id: 3, meaning: 'C' },
      { id: 4, meaning: 'D' },
    ]),
    handleChoice: vi.fn(),
    choiceNext: vi.fn(),
  };

  const spelling = {
    spellingAnswered: ref(false),
    checkSpelling: vi.fn(),
    spellingNext: vi.fn(),
  };

  const deps = {
    studyMode: ref('flashcard'),
    modeSelected: ref(true),
    finished: ref(false),
    currentCard: ref({ word: { name: 'inspect' } }),
    showAnswer: ref(false),
    submitting: ref(false),
    speak,
    choice,
    spelling,
    flipCard,
    submitRating,
    ...overrides,
  };

  return { deps, speak, flipCard, submitRating, choice, spelling };
}

// ── 前置条件守卫 ──────────────────────────────────────────────

describe('守卫条件', () => {
  it('modeSelected=false 时忽略所有按键', () => {
    const { deps, flipCard } = makeDefaultDeps();
    deps.modeSelected.value = false;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Space'));
    expect(flipCard).not.toHaveBeenCalled();
  });

  it('finished=true 时忽略所有按键', () => {
    const { deps, flipCard } = makeDefaultDeps();
    deps.finished.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Space'));
    expect(flipCard).not.toHaveBeenCalled();
  });

  it('currentCard=null 时忽略所有按键', () => {
    const { deps, flipCard } = makeDefaultDeps();
    deps.currentCard.value = null;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Space'));
    expect(flipCard).not.toHaveBeenCalled();
  });
});

// ── 闪卡模式 ──────────────────────────────────────────────────

describe('flashcard 模式', () => {
  it('showAnswer=false 时 Space 翻牌', () => {
    const { deps, flipCard } = makeDefaultDeps({ studyMode: ref('flashcard') });
    const { handleKeyDown } = useStudyKeyboard(deps);
    const e = makeEvent('Space');
    handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(flipCard).toHaveBeenCalledTimes(1);
  });

  it('showAnswer=true 时 Space 重播发音', () => {
    const { deps, speak } = makeDefaultDeps({ studyMode: ref('flashcard') });
    deps.showAnswer.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Space'));
    expect(speak).toHaveBeenCalledWith('inspect');
  });

  it('showAnswer=true 时按数字 1-4 触发 submitRating', () => {
    const { deps, submitRating } = makeDefaultDeps({ studyMode: ref('flashcard') });
    deps.showAnswer.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Digit1', '1'));
    handleKeyDown(makeEvent('Digit2', '2'));
    handleKeyDown(makeEvent('Digit3', '3'));
    handleKeyDown(makeEvent('Digit4', '4'));
    expect(submitRating).toHaveBeenCalledTimes(4);
    expect(submitRating.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4]);
  });

  it('showAnswer=false 时数字键不触发评分', () => {
    const { deps, submitRating } = makeDefaultDeps({ studyMode: ref('flashcard') });
    deps.showAnswer.value = false;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Digit1', '1'));
    expect(submitRating).not.toHaveBeenCalled();
  });

  it('submitting=true 时忽略评分按键', () => {
    const { deps, submitRating } = makeDefaultDeps({ studyMode: ref('flashcard') });
    deps.showAnswer.value = true;
    deps.submitting.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Digit3', '3'));
    expect(submitRating).not.toHaveBeenCalled();
  });

  it('输入框内按 Space 不翻牌', () => {
    const { deps, flipCard } = makeDefaultDeps({ studyMode: ref('flashcard') });
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Space', ' ', 'INPUT'));
    expect(flipCard).not.toHaveBeenCalled();
  });
});

// ── 选择题模式 ────────────────────────────────────────────────

describe('choice 模式', () => {
  it('按字母 a/b/c/d 触发对应选项', () => {
    const { deps, choice } = makeDefaultDeps({ studyMode: ref('choice') });
    const { handleKeyDown } = useStudyKeyboard(deps);

    handleKeyDown(makeEvent('KeyA', 'a'));
    expect(choice.handleChoice).toHaveBeenCalledWith(0);

    handleKeyDown(makeEvent('KeyB', 'b'));
    expect(choice.handleChoice).toHaveBeenCalledWith(1);
  });

  it('按数字 1/2/3/4 触发对应选项', () => {
    const { deps, choice } = makeDefaultDeps({ studyMode: ref('choice') });
    const { handleKeyDown } = useStudyKeyboard(deps);

    handleKeyDown(makeEvent('Digit1', '1'));
    expect(choice.handleChoice).toHaveBeenCalledWith(0);
  });

  it('已作答后 Enter 进入下一题', () => {
    const { deps, choice } = makeDefaultDeps({ studyMode: ref('choice') });
    deps.choice.choiceAnswered.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);

    const e = makeEvent('Enter');
    handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(choice.choiceNext).toHaveBeenCalledTimes(1);
  });

  it('已作答后 Space 进入下一题', () => {
    const { deps, choice } = makeDefaultDeps({ studyMode: ref('choice') });
    deps.choice.choiceAnswered.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);

    const e = makeEvent('Space');
    handleKeyDown(e);
    expect(choice.choiceNext).toHaveBeenCalledTimes(1);
  });

  it('选项数量 < 按键对应 idx 时不触发选择', () => {
    const { deps, choice } = makeDefaultDeps({ studyMode: ref('choice') });
    deps.choice.choiceOptions.value = [{ id: 1, meaning: 'A' }]; // 只有 1 个选项
    const { handleKeyDown } = useStudyKeyboard(deps);

    handleKeyDown(makeEvent('KeyD', 'd')); // idx=3，超出范围
    expect(choice.handleChoice).not.toHaveBeenCalled();
  });
});

// ── 拼写模式 ──────────────────────────────────────────────────

describe('spelling 模式', () => {
  it('未作答时 Enter 触发 checkSpelling', () => {
    const { deps, spelling } = makeDefaultDeps({ studyMode: ref('spelling') });
    const { handleKeyDown } = useStudyKeyboard(deps);
    const e = makeEvent('Enter');
    handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(spelling.checkSpelling).toHaveBeenCalledTimes(1);
  });

  it('已作答后 Enter 触发 spellingNext', () => {
    const { deps, spelling } = makeDefaultDeps({ studyMode: ref('spelling') });
    deps.spelling.spellingAnswered.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);

    const e = makeEvent('Enter');
    handleKeyDown(e);
    expect(spelling.spellingNext).toHaveBeenCalledTimes(1);
    expect(spelling.checkSpelling).not.toHaveBeenCalled();
  });
});

// ── 听力模式 ──────────────────────────────────────────────────

describe('listening 模式', () => {
  it('未作答时 Space 重播发音', () => {
    const { deps, speak } = makeDefaultDeps({ studyMode: ref('listening') });
    const { handleKeyDown } = useStudyKeyboard(deps);
    const e = makeEvent('Space');
    handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('inspect');
  });

  it('未作答时 Enter 触发 checkSpelling', () => {
    const { deps, spelling } = makeDefaultDeps({ studyMode: ref('listening') });
    const { handleKeyDown } = useStudyKeyboard(deps);
    handleKeyDown(makeEvent('Enter'));
    expect(spelling.checkSpelling).toHaveBeenCalledTimes(1);
  });

  it('已作答后 Space 触发 spellingNext', () => {
    const { deps, spelling } = makeDefaultDeps({ studyMode: ref('listening') });
    deps.spelling.spellingAnswered.value = true;
    const { handleKeyDown } = useStudyKeyboard(deps);

    const e = makeEvent('Space');
    handleKeyDown(e);
    expect(spelling.spellingNext).toHaveBeenCalledTimes(1);
  });
});
