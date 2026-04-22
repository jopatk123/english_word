/**
 * 学习会话键盘快捷键处理
 *
 * 将键盘逻辑从 useStudySession 中解耦，使其可独立测试。
 * 各模式的快捷键行为：
 *   闪卡  —— Space 翻牌/重播；1/2/3/4 快速评分
 *   选择题 —— a/b/c/d 或 1/2/3/4 选择；Enter/Space 下一题
 *   拼写   —— Enter 确认/下一题
 *   听力   —— Space 重播发音；Enter 确认/下一题
 *
 * @param {Object} deps
 * @param {import('vue').Ref}         deps.studyMode
 * @param {import('vue').Ref}         deps.modeSelected
 * @param {import('vue').Ref}         deps.finished
 * @param {import('vue').ComputedRef} deps.currentCard
 * @param {import('vue').Ref}         deps.showAnswer
 * @param {import('vue').Ref}         deps.submitting
 * @param {Function}                  deps.speak          - speak(text)
 * @param {Object}                    deps.choice         - { choiceAnswered, choiceOptions, handleChoice, choiceNext }
 * @param {Object}                    deps.spelling       - { spellingAnswered, checkSpelling, spellingNext }
 * @param {Function}                  deps.flipCard
 * @param {Function}                  deps.submitRating
 */
export function useStudyKeyboard({
  studyMode,
  modeSelected,
  finished,
  currentCard,
  showAnswer,
  submitting,
  speak,
  choice,
  spelling,
  flipCard,
  submitRating,
}) {
  function handleKeyDown(e) {
    if (!modeSelected.value || finished.value || !currentCard.value) return;

    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // ── 闪卡模式 ────────────────────────────────────────────────
    if (studyMode.value === 'flashcard' && !inInput) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer.value) {
          flipCard();
        } else {
          speak(currentCard.value.word.name);
        }
        return;
      }
      if (showAnswer.value && !submitting.value) {
        const rating = { 1: 1, 2: 2, 3: 3, 4: 4 }[e.key];
        if (rating !== undefined) submitRating(rating);
      }
      return;
    }

    // ── 选择题模式 ───────────────────────────────────────────────
    if (studyMode.value === 'choice') {
      if (!choice.choiceAnswered.value) {
        const KEY_TO_IDX = { a: 0, 1: 0, b: 1, 2: 1, c: 2, 3: 2, d: 3, 4: 3 };
        const idx = KEY_TO_IDX[e.key.toLowerCase()];
        if (idx !== undefined && idx < choice.choiceOptions.value.length) {
          e.preventDefault();
          choice.handleChoice(idx);
        }
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        choice.choiceNext();
      }
      return;
    }

    // ── 拼写 & 听力模式 ─────────────────────────────────────────
    if (studyMode.value === 'spelling' || studyMode.value === 'listening') {
      if (spelling.spellingAnswered.value) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          spelling.spellingNext();
        }
        return;
      }

      if (e.code === 'Enter') {
        e.preventDefault();
        spelling.checkSpelling();
        return;
      }

      // 听力模式：Space 始终重播发音，不向输入框写入空格
      if (studyMode.value === 'listening' && e.code === 'Space') {
        e.preventDefault();
        speak(currentCard.value.word.name);
      }
    }
  }

  return { handleKeyDown };
}
