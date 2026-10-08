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
        actionPending: false,
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

  it('快捷预设为 15/30/45/60/120 分钟', () => {
    const wrapper = createWrapper();
    const presetTexts = wrapper.findAll('.stp-preset').map((button) => button.text());

    expect(presetTexts).toEqual(['15分钟', '30分钟', '45分钟', '60分钟', '120分钟']);
  });

  it('点击预设会发出更新事件', async () => {
    const wrapper = createWrapper();
    const presets = wrapper.findAll('.stp-preset');
    await presets[2].trigger('click');
    await presets[4].trigger('click');

    expect(wrapper.emitted('update:alarmMinutes')?.[0]).toEqual([45]);
    expect(wrapper.emitted('update:alarmMinutes')?.[1]).toEqual([120]);
  });

  it('处理中时禁用开始按钮，避免重复提交', () => {
    const wrapper = createWrapper({ actionPending: true });
    const startButton = wrapper.find('.stp-btn-start');

    expect(startButton.attributes('disabled')).toBeDefined();
    expect(startButton.text()).toContain('处理中');
  });
});
