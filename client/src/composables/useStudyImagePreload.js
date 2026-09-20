import { watch, onUnmounted } from 'vue';
import { clearWordImageCache, preloadNextStudyWordImage } from '../utils/wordImageCache.js';

export function useStudyImagePreload({ queue, currentIndex, modeSelected, finished }) {
  watch(
    [queue, currentIndex, modeSelected, finished],
    () => {
      if (!modeSelected.value || finished.value) return;
      preloadNextStudyWordImage(queue.value, currentIndex.value);
    },
    { immediate: true, flush: 'post' }
  );

  onUnmounted(() => {
    clearWordImageCache();
  });
}
