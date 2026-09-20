import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStudyImagePreload } from '../useStudyImagePreload.js';

const { preloadNextStudyWordImageMock, clearWordImageCacheMock } = vi.hoisted(() => ({
  preloadNextStudyWordImageMock: vi.fn(),
  clearWordImageCacheMock: vi.fn(),
}));

vi.mock('../../utils/wordImageCache.js', () => ({
  preloadNextStudyWordImage: (...args) => preloadNextStudyWordImageMock(...args),
  clearWordImageCache: (...args) => clearWordImageCacheMock(...args),
}));

const mountHost = ({ queue, currentIndex, modeSelected, finished }) => {
  const wrapper = mount(
    defineComponent({
      setup() {
        useStudyImagePreload({
          queue,
          currentIndex,
          modeSelected,
          finished,
        });
        return () => h('div');
      },
    })
  );
  return wrapper;
};

describe('useStudyImagePreload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('进入学习后预加载下一张有图的卡片', async () => {
    const queue = ref([
      { wordId: 1, word: { id: 1, hasImage: true } },
      { wordId: 2, word: { id: 2, hasImage: true } },
    ]);
    mountHost({
      queue,
      currentIndex: ref(0),
      modeSelected: ref(true),
      finished: ref(false),
    });
    await flushPromises();

    expect(preloadNextStudyWordImageMock).toHaveBeenCalledWith(queue.value, 0);
  });

  it('切换卡片后按新索引重新预加载', async () => {
    const queue = ref([
      { wordId: 1, word: { id: 1, hasImage: true } },
      { wordId: 2, word: { id: 2, hasImage: true } },
      { wordId: 3, word: { id: 3, hasImage: true } },
    ]);
    const currentIndex = ref(0);
    mountHost({
      queue,
      currentIndex,
      modeSelected: ref(true),
      finished: ref(false),
    });
    await flushPromises();
    expect(preloadNextStudyWordImageMock).toHaveBeenCalledTimes(1);
    expect(preloadNextStudyWordImageMock).toHaveBeenLastCalledWith(queue.value, 0);

    currentIndex.value = 1;
    await flushPromises();
    expect(preloadNextStudyWordImageMock).toHaveBeenCalledTimes(2);
    expect(preloadNextStudyWordImageMock).toHaveBeenLastCalledWith(queue.value, 1);
  });

  it('尚未选模式或已结束时不预加载', async () => {
    mountHost({
      queue: ref([{ wordId: 1, word: { id: 1, hasImage: true } }]),
      currentIndex: ref(0),
      modeSelected: ref(false),
      finished: ref(false),
    });
    await flushPromises();
    expect(preloadNextStudyWordImageMock).not.toHaveBeenCalled();
  });

  it('卸载时清空缓存', () => {
    const wrapper = mountHost({
      queue: ref([]),
      currentIndex: ref(0),
      modeSelected: ref(false),
      finished: ref(false),
    });
    wrapper.unmount();
    expect(clearWordImageCacheMock).toHaveBeenCalledTimes(1);
  });
});
