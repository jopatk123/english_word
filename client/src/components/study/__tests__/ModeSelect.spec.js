import { mount } from '@vue/test-utils';
import ModeSelect from '../ModeSelect.vue';

describe('ModeSelect', () => {
  it('shows the auto-read mode option', () => {
    const wrapper = mount(ModeSelect, {
      props: {
        queueLength: 8,
        resumeInfo: null,
        modeNames: {
          flashcard: '闪卡',
          choice: '选择题',
          spelling: '拼写',
          listening: '听力',
          autoRead: '自动朗读',
        },
      },
    });

    expect(wrapper.text()).toContain('自动朗读');
    expect(wrapper.text()).toContain('不记录熟练度');
  });
});