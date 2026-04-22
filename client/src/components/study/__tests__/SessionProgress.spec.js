import { mount } from '@vue/test-utils';
import SessionProgress from '../SessionProgress.vue';
import { globalStubs } from './studyTestUtils';

describe('SessionProgress', () => {
  const createWrapper = (props = {}) =>
    mount(SessionProgress, {
      props: { currentIndex: 0, total: 10, ...props },
      global: { stubs: globalStubs },
    });

  it('显示进度文字 1/10', () => {
    const wrapper = createWrapper({ currentIndex: 0, total: 10 });
    expect(wrapper.text()).toContain('1 / 10');
  });

  it('currentIndex=4 时显示 5/10', () => {
    const wrapper = createWrapper({ currentIndex: 4, total: 10 });
    expect(wrapper.text()).toContain('5 / 10');
  });

  it('拖动进度条会触发 seek 事件', async () => {
    const wrapper = createWrapper({ currentIndex: 2, total: 8 });
    const input = wrapper.find('input[type="range"]');

    expect(input.exists()).toBe(true);

    await input.setValue('6');

    expect(wrapper.emitted('seek')[0]).toEqual([5]);
  });
});