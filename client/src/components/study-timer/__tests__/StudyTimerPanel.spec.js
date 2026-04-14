import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StudyTimerPanel from '../StudyTimerPanel.vue';

const globalStubs = {
  StudyTimerStats: { template: '<div class="stats-stub" />' },
};

describe('StudyTimerPanel', () => {
  const createWrapper = (props = {}) =>
    mount(StudyTimerPanel, {
      props: {
        isRunning: false,
        alarmEnabled: true,
        todaySeconds: 0,
        totalSeconds: 0,
        savedTotalSeconds: 0,
        ...props,
      },
      global: {
        stubs: globalStubs,
      },
    });

  it('默认提醒时长为 30 分钟', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('学习 30 分钟后提醒休息');

    const activePreset = wrapper.find('.stp-preset.active');
    expect(activePreset.exists()).toBe(true);
    expect(activePreset.text()).toBe('30分钟');
  });

  it('快捷预设改为 15/30/45/60 分钟', () => {
    const wrapper = createWrapper();
    const presetTexts = wrapper.findAll('.stp-preset').map((button) => button.text());

    expect(presetTexts).toEqual(['15分钟', '30分钟', '45分钟', '60分钟']);
  });

  it('点击预设会发出更新事件', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.stp-preset')[2].trigger('click');

    expect(wrapper.emitted('update:alarmMinutes')?.[0]).toEqual([45]);
  });
});
