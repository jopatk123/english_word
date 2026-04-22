import { mount } from '@vue/test-utils';
import ModeSelect from '../ModeSelect.vue';
import { globalStubs } from './studyTestUtils';

describe('ModeSelect', () => {
  const modeNames = {
    flashcard: '闪卡',
    choice: '选择题',
    spelling: '拼写',
    listening: '听力',
    autoRead: '自动朗读',
  };

  const createWrapper = (props = {}) =>
    mount(ModeSelect, {
      props: { queueLength: 10, modeNames, resumeInfo: null, ...props },
      global: { stubs: globalStubs },
    });

  it('显示待复习单词数量', () => {
    const wrapper = createWrapper({ queueLength: 5 });
    expect(wrapper.text()).toContain('5');
    expect(wrapper.text()).toContain('待复习');
  });

  it('resumeInfo 为 null 时不显示断点续学', () => {
    const wrapper = createWrapper({ resumeInfo: null });
    expect(wrapper.find('.resume-banner').exists()).toBe(false);
  });

  it('resumeInfo 存在时显示断点续学', () => {
    const wrapper = createWrapper({ resumeInfo: { index: 2, mode: 'flashcard' } });
    expect(wrapper.find('.resume-banner').exists()).toBe(true);
    expect(wrapper.text()).toContain('3');
  });

  it('点击闪卡模式触发 select flashcard', async () => {
    const wrapper = createWrapper();
    const cards = wrapper.findAll('.mode-card');
    await cards[0].trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')[0]).toEqual(['flashcard']);
  });

  it('点击选择题触发 select choice', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[1].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['choice']);
  });

  it('点击拼写模式触发 select spelling', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[2].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['spelling']);
  });

  it('点击听力模式触发 select listening', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[3].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['listening']);
  });

  it('显示所有五种学习模式', () => {
    const wrapper = createWrapper();
    const cards = wrapper.findAll('.mode-card');
    expect(cards).toHaveLength(5);
  });

  it('点击自动朗读触发 select autoRead', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[4].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['autoRead']);
  });

  it('断点续学显示 resume 和 dismiss 按钮', async () => {
    const wrapper = createWrapper({ resumeInfo: { index: 1, mode: 'spelling' } });
    const buttons = wrapper.findAll('.el-btn');
    const resumeBtn = buttons.find((b) => b.text().includes('继续'));
    const dismissBtn = buttons.find((b) => b.text().includes('重新'));
    await resumeBtn?.trigger('click');
    expect(wrapper.emitted('resume')).toBeTruthy();
    await dismissBtn?.trigger('click');
    expect(wrapper.emitted('dismiss')).toBeTruthy();
  });

  it('shows the auto-read mode option', () => {
    const wrapper = createWrapper();

    expect(wrapper.text()).toContain('自动朗读');
    expect(wrapper.text()).toContain('不记录熟练度');
  });
});