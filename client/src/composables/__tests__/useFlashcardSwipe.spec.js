import { describe, expect, it, vi } from 'vitest';
import { useFlashcardSwipe } from '../useFlashcardSwipe.js';

const createHandlers = (overrides = {}) => {
  const flip = vi.fn();
  const rate = vi.fn();
  const handlers = useFlashcardSwipe({
    isAnswerShown: () => false,
    isSubmitting: () => false,
    flip,
    rate,
    ...overrides,
  });
  return { ...handlers, flip, rate };
};

const touchEvent = (x, y, target = { closest: () => null }) => ({
  target,
  changedTouches: [{ clientX: x, clientY: y }],
});

describe('useFlashcardSwipe', () => {
  it('horizontal swipe flips the card before the answer is shown', () => {
    const { onTouchStart, onTouchEnd, flip, rate } = createHandlers();
    onTouchStart(touchEvent(200, 10));
    onTouchEnd(touchEvent(20, 12));
    expect(flip).toHaveBeenCalledTimes(1);
    expect(rate).not.toHaveBeenCalled();
  });

  it('ignores vertical movement', () => {
    const { onTouchStart, onTouchEnd, flip } = createHandlers();
    onTouchStart(touchEvent(10, 10));
    onTouchEnd(touchEvent(20, 120));
    expect(flip).not.toHaveBeenCalled();
  });

  it('rates again on left swipe after the answer is shown', () => {
    const { onTouchStart, onTouchEnd, rate } = createHandlers({
      isAnswerShown: () => true,
    });
    onTouchStart(touchEvent(200, 10));
    onTouchEnd(touchEvent(20, 10));
    expect(rate).toHaveBeenCalledWith(1);
  });

  it('does not start a gesture from interactive controls', () => {
    const { onTouchStart, onTouchEnd, flip } = createHandlers();
    onTouchStart(
      touchEvent(200, 10, {
        closest: () => ({}),
      })
    );
    onTouchEnd(touchEvent(20, 10));
    expect(flip).not.toHaveBeenCalled();
  });
});
