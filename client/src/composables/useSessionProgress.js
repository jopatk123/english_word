import { getStudySessionSyncChannel } from './studySessionHelpers.js';

/**
 * Manages study session progress persistence and multi-tab synchronisation.
 *
 * @param {object} deps
 * @param {() => string}               deps.getScope
 * @param {() => string}               deps.getQueueIds
 * @param {import('vue').Ref}          deps.queue
 * @param {import('vue').Ref<number>}  deps.currentIndex
 * @param {import('vue').Ref<string>}  deps.studyMode
 * @param {import('vue').Ref<boolean>} deps.modeSelected
 * @param {import('vue').Ref<object>}  deps.sessionStats
 * @param {import('vue').Ref<object>}  deps.againCountMap
 * @param {import('vue').Ref<boolean>} deps.finished
 * @param {import('vue').Ref<boolean>} deps.showAnswer
 * @param {import('vue').Ref}          deps.resumeInfo
 * @param {() => void}                 deps.resetAllModes
 * @param {(mode: string) => void}     deps.initModeCard
 */
export function useSessionProgress({
  getScope,
  getQueueIds,
  queue,
  currentIndex,
  studyMode,
  modeSelected,
  sessionStats,
  againCountMap,
  finished,
  showAnswer,
  resumeInfo,
  resetAllModes,
  initModeCard,
}) {
  const saveProgress = () => {
    const data = {
      index: currentIndex.value,
      stats: sessionStats.value,
      againMap: againCountMap.value,
      mode: studyMode.value,
      scope: getScope(),
      queueIds: getQueueIds(),
    };
    localStorage.setItem('study-session-progress', JSON.stringify(data));
    getStudySessionSyncChannel().publish({ type: 'progress', data });
  };

  const clearProgress = () => {
    localStorage.removeItem('study-session-progress');
    getStudySessionSyncChannel().publish({
      type: 'cleared',
      scope: getScope(),
      queueIds: getQueueIds(),
    });
  };

  const applyRemoteProgress = (progress) => {
    if (!progress || progress.queueIds !== getQueueIds() || progress.scope !== getScope()) {
      return;
    }

    studyMode.value = progress.mode || studyMode.value;
    modeSelected.value = Boolean(progress.mode || modeSelected.value);
    sessionStats.value = progress.stats || { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
    againCountMap.value = progress.againMap || {};
    currentIndex.value = Math.min(
      Math.max(Number.isFinite(progress.index) ? progress.index : 0, 0),
      Math.max(queue.value.length - 1, 0)
    );
    finished.value = queue.value.length > 0 && progress.index >= queue.value.length;
    showAnswer.value = false;
    resetAllModes();
    initModeCard(studyMode.value);
  };

  const handleStudySessionSync = (event) => {
    if (!event) return;

    if (event.type === 'mode') {
      if (event.queueIds !== getQueueIds() || event.scope !== getScope()) return;
      studyMode.value = event.mode || studyMode.value;
      modeSelected.value = Boolean(event.mode || modeSelected.value);
      initModeCard(studyMode.value);
      return;
    }

    if (event.type === 'progress') {
      applyRemoteProgress(event.data);
      return;
    }

    if (
      event.type === 'cleared' &&
      event.queueIds === getQueueIds() &&
      event.scope === getScope()
    ) {
      resumeInfo.value = null;
    }
  };

  return { saveProgress, clearProgress, applyRemoteProgress, handleStudySessionSync };
}
