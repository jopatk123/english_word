import { createTabSyncChannel } from '../utils/tabSync.js';

let studySessionSyncChannel;

/** Lazily creates/returns a shared tab-sync channel for study session state. */
export const getStudySessionSyncChannel = () => {
  if (!studySessionSyncChannel) {
    studySessionSyncChannel = createTabSyncChannel('study-session');
  }
  return studySessionSyncChannel;
};

/**
 * Seeks the session to a specific queue index.
 * Returns true if the jump occurred, false otherwise.
 */
export function seekToStudyCard({
  targetIndex,
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
  stopAutoRead,
}) {
  if (submitting?.value) return false;
  if (!Number.isFinite(targetIndex) || queue.value.length === 0) return false;

  const nextIndex = Math.min(Math.max(Math.trunc(targetIndex), 0), queue.value.length - 1);
  if (nextIndex === currentIndex.value) return false;

  if (typeof stopAutoRead === 'function') {
    stopAutoRead();
  }

  currentIndex.value = nextIndex;
  finished.value = false;
  showAnswer.value = false;
  resetModes();

  if (typeof incrementRevision === 'function') {
    incrementRevision();
  }

  initModeCard(studyMode.value);
  saveProgress();
  return true;
}

/** Builds the TTS text sequence for a study card (word × 2, then example sentences). */
export function buildAutoReadTexts(card) {
  const word = card?.word?.name?.trim();
  const sentences = (card?.word?.examples || [])
    .map((example) => example?.sentence?.trim())
    .filter(Boolean);
  const texts = [];

  if (word) {
    texts.push(word, word);
  }

  texts.push(...sentences);
  return texts;
}
