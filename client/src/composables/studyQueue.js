export const FOLLOW_UP_OFFSETS = Object.freeze({
  AGAIN: 3,
  HARD: 2,
});

export const MAX_FOLLOW_UP_INSERTIONS = 3;

export function insertFollowUpCard(queue, card, currentIndex, offset) {
  if (!card || !Array.isArray(queue) || queue.length === 0) {
    return Array.isArray(queue) ? [...queue] : [];
  }

  const nextQueue = [...queue];
  const insertAt = Math.min(Math.max(Math.trunc(currentIndex) + offset, 0), nextQueue.length);
  nextQueue.splice(insertAt, 0, { ...card });
  return nextQueue;
}
