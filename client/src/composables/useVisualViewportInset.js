import { onMounted, onUnmounted, ref } from 'vue';

export function getVisualViewportInset(viewport, innerHeight) {
  if (!viewport) return 0;
  const occluded = innerHeight - viewport.height - viewport.offsetTop;
  return Math.max(0, Math.round(occluded));
}

/**
 * 软键盘顶起时，视觉视口被遮挡的底部高度（用于给学习页让出空间）。
 */
export function useVisualViewportInset() {
  const inset = ref(0);

  const update = () => {
    inset.value = getVisualViewportInset(window.visualViewport, window.innerHeight);
  };

  onMounted(() => {
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();
  });

  onUnmounted(() => {
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  });

  return inset;
}
