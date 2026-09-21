import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClickableSentence from '../ClickableSentence.vue';

const openWordLookup = vi.fn();

vi.mock('../../composables/wordLookup.js', () => ({
  openWordLookup: (...args) => openWordLookup(...args),
  wordLookupState: { visible: false, word: '', sentence: '' },
}));

describe('ClickableSentence', () => {
  beforeEach(() => {
    openWordLookup.mockClear();
  });

  it('点击单词时查询该词，并带上整句', async () => {
    const wrapper = mount(ClickableSentence, {
      props: { text: 'She inspects the room.' },
    });

    const button = wrapper.find('button[aria-label="查询 inspects"]');
    expect(button.exists()).toBe(true);
    await button.trigger('click');

    expect(openWordLookup).toHaveBeenCalledTimes(1);
    expect(openWordLookup.mock.calls[0][0]).toMatchObject({
      word: 'inspects',
      sentence: 'She inspects the room.',
    });
    expect(wrapper.emitted('click')).toBeFalsy();
  });

  it('标点保持不可点击', () => {
    const wrapper = mount(ClickableSentence, {
      props: { text: 'Hello, world!' },
    });
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.text()).toContain('Hello, world!');
  });
});
