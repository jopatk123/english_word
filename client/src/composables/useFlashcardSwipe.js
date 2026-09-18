const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, .speak-btn, .el-button';
const MIN_DISTANCE = 56;

const isInteractiveTarget = (target) =>
  Boolean(target?.closest?.(INTERACTIVE_SELECTOR));

/**
 * 闪卡触摸手势：左右滑翻牌；已翻开时左滑「再来一遍」、右滑「认识」。
 */
export function useFlashcardSwipe({ isAnswerShown, isSubmitting, flip, rate }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let suppressClick = false;

  const onTouchStart = (event) => {
    if (isInteractiveTarget(event.target)) {
      tracking = false;
      return;
    }
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
    suppressClick = false;
  };

  const onTouchEnd = (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    suppressClick = true;
    if (!isAnswerShown()) {
      flip();
      return;
    }
    if (isSubmitting()) return;
    rate(dx < 0 ? 1 : 3);
  };

  const onCardClick = () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!isAnswerShown()) {
      flip();
    }
  };

  return { onTouchStart, onTouchEnd, onCardClick };
}
