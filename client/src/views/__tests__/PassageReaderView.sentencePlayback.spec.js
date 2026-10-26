import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PassageReaderView from '../PassageReaderView.vue';

const speakAsync = vi.fn();
const cancelSpeech = vi.fn();

vi.mock('../../utils/speech.js', () => ({
  DEFAULT_SPEECH_RATE: 0.85,
  useSpeech: () => ({ speakAsync, cancelSpeech, speak: vi.fn() }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { prompt: vi.fn() },
}));

vi.mock('../../api/index.js', () => ({
  getPassage: () =>
    Promise.resolve({
      data: {
        id: 1,
        title: 'A Simple Morning Walk',
        level: 'B1',
        source: 'manual',
        status: 'due',
        wordCount: 4,
        sentenceCount: 3,
        review: null,
        sentences: [
          { id: 11, orderIndex: 0, paragraphIndex: 0, text: 'One.', translation: '' },
          { id: 12, orderIndex: 1, paragraphIndex: 0, text: 'Two.', translation: '' },
          { id: 13, orderIndex: 2, paragraphIndex: 1, text: 'Three.', translation: '' },
        ],
      },
    }),
  recordPassageRead: vi.fn(),
  translatePassage: vi.fn(),
  updatePassageSentence: vi.fn(),
  lookupWordStatuses: vi.fn().mockResolvedValue({ data: { items: {} } }),
}));

describe('PassageReaderView 句末按钮实际朗读', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    speakAsync.mockReset();
    cancelSpeech.mockReset();
    speakAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('点击句末按钮只朗读这一句，底部进度停在该句', async () => {
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
          'el-dialog': {
            props: ['modelValue'],
            template: '<div v-if="modelValue"><slot /></div>',
          },
        },
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    const sentenceButtons = wrapper.findAll('button[aria-label="只读这一句"]');
    await sentenceButtons[1].trigger('click');
    await vi.advanceTimersByTimeAsync(800);

    expect(speakAsync.mock.calls.map((call) => call[0])).toEqual(['Two.']);
    expect(wrapper.find('.passage-player-progress').text()).toBe('第 2 / 3 句');
    expect(wrapper.find('button[aria-label="播放"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('读完了，感觉怎么样');

    wrapper.unmount();
  });
});
