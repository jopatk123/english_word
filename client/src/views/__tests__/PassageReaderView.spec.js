import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PassageReaderView from '../PassageReaderView.vue';

const { getPassageMock, pushMock, playback } = vi.hoisted(() => ({
  getPassageMock: vi.fn(),
  pushMock: vi.fn(),
  playback: {
    playing: { value: false },
    currentIndex: { value: -1 },
    currentSentence: { value: null },
    loop: { value: false },
    rate: { value: 0.85 },
    play: vi.fn(),
    playSentence: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    setRate: vi.fn(),
    toggleLoop: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { prompt: vi.fn() },
}));

vi.mock('../../api/index.js', () => ({
  getPassage: (...args) => getPassageMock(...args),
  recordPassageRead: vi.fn(),
  setPassageArchived: vi.fn(),
  translatePassage: vi.fn(),
  updatePassageSentence: vi.fn(),
  lookupWordStatuses: vi.fn().mockResolvedValue({ data: { items: {} } }),
}));

vi.mock('../../composables/usePassagePlayback.js', () => ({
  usePassagePlayback: () => playback,
}));

vi.mock('../../components/ClickableSentence.vue', () => ({
  default: {
    props: ['text'],
    template: '<span class="clickable-sentence-stub">{{ text }}</span>',
  },
}));

const passage = {
  id: 1,
  title: 'A Simple Morning Walk',
  level: 'B1',
  source: 'manual',
  status: 'due',
  wordCount: 4,
  sentenceCount: 3,
  review: null,
  next: { id: 2, title: 'The Next Story', status: 'unread' },
  sentences: [
    { id: 11, orderIndex: 0, paragraphIndex: 0, text: 'One.', translation: '' },
    { id: 12, orderIndex: 1, paragraphIndex: 0, text: 'Two.', translation: '' },
    { id: 13, orderIndex: 2, paragraphIndex: 1, text: 'Three.', translation: '' },
  ],
};

const mountReader = async () => {
  const wrapper = mount(PassageReaderView, {
    props: { id: '1' },
    global: {
      directives: { loading: () => {} },
      stubs: {
        'el-breadcrumb': { template: '<nav><slot /></nav>' },
        'el-breadcrumb-item': { template: '<span><slot /></span>' },
        'el-tag': { template: '<span><slot /></span>' },
        'el-button': {
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
        },
        'el-alert': { template: '<div />' },
        'el-dialog': { template: '<div><slot /></div>' },
      },
    },
  });
  await flushPromises();
  return wrapper;
};

describe('PassageReaderView 单句朗读', () => {
  beforeEach(() => {
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue({ data: passage });
    playback.play.mockReset();
    playback.playSentence.mockReset();
    playback.toggle.mockReset();
    playback.stop.mockReset();
    pushMock.mockReset();
  });

  it('点击句末按钮只朗读该句，底部播放键仍走连续听读', async () => {
    const wrapper = await mountReader();

    expect(wrapper.text()).toContain('「▶」只读这一句');
    expect(wrapper.text()).not.toContain('从这句开始朗读');

    const sentenceButtons = wrapper.findAll('button[aria-label="只读这一句"]');
    expect(sentenceButtons).toHaveLength(3);
    await sentenceButtons[1].trigger('click');

    expect(playback.playSentence).toHaveBeenCalledTimes(1);
    expect(playback.playSentence).toHaveBeenCalledWith(1);
    expect(playback.play).not.toHaveBeenCalled();
    expect(wrapper.find('button[aria-label="播放"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="播放"]').trigger('click');
    expect(playback.toggle).toHaveBeenCalledTimes(1);
    expect(playback.playSentence).toHaveBeenCalledTimes(1);
  });

  it('进入听读时从第一句连续播放', async () => {
    const wrapper = await mountReader();
    const listen = wrapper.findAll('button').find((button) => button.text().includes('▶ 听读'));
    await listen.trigger('click');

    expect(playback.play).toHaveBeenCalledWith(0);
    expect(playback.playSentence).not.toHaveBeenCalled();
  });

  it('点击下一篇进入列表中的下一篇短文', async () => {
    const wrapper = await mountReader();
    const nextButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().includes('下一篇'));
    expect(nextButtons.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('下一篇：The Next Story');
    await nextButtons[0].trigger('click');
    expect(playback.stop).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/reading/2');
  });

  it('没有下一篇时不显示下一篇按钮', async () => {
    getPassageMock.mockResolvedValue({ data: { ...passage, next: null } });
    const wrapper = await mountReader();
    expect(wrapper.text()).not.toContain('下一篇');
  });

  it('归档后隐藏读完了，仍可听读', async () => {
    getPassageMock.mockResolvedValue({
      data: { ...passage, status: 'archived', archived: true },
    });
    const wrapper = await mountReader();
    const labels = wrapper.findAll('button').map((button) => button.text());
    expect(labels.some((text) => text.includes('取消归档'))).toBe(true);
    expect(labels.some((text) => text.includes('读完了'))).toBe(false);
    expect(labels.some((text) => text.includes('▶ 听读'))).toBe(true);
  });
});
