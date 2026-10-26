import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PassageText from '../PassageText.vue';

vi.mock('../../ClickableSentence.vue', () => ({
  default: {
    props: ['text'],
    template: '<span class="clickable-sentence-stub">{{ text }}</span>',
  },
}));

const sentences = [
  { id: 11, orderIndex: 0, paragraphIndex: 0, text: 'One.', translation: '' },
  { id: 12, orderIndex: 1, paragraphIndex: 0, text: 'Two.', translation: '' },
];

describe('PassageText', () => {
  it('句末按钮只宣告朗读这一句，并带上该句序号', async () => {
    const wrapper = mount(PassageText, {
      props: { passageId: 1, sentences },
    });

    const buttons = wrapper.findAll('button[aria-label="只读这一句"]');
    expect(buttons).toHaveLength(2);
    expect(wrapper.find('button[aria-label="从这句开始朗读"]').exists()).toBe(false);

    await buttons[1].trigger('click');

    expect(wrapper.emitted('play-sentence')).toEqual([[1]]);
    expect(wrapper.emitted('play-from')).toBeFalsy();
  });
});
