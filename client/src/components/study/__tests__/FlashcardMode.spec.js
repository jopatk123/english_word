import { mount } from '@vue/test-utils';
import FlashcardMode from '../FlashcardMode.vue';
import { globalStubs } from './studyTestUtils';

describe('FlashcardMode', () => {
  const defaultCard = {
    wordId: 1,
    word: {
      id: 1,
      name: 'inspect',
      phonetic: '/ɪnˈspekt/',
      meaning: '检查；视察',
      roots: [{ name: 'spect', meaning: '看' }],
      examples: [{ id: 1, sentence: 'She inspects the room.', translation: '她检查房间。' }],
    },
  };

  const createWrapper = (props = {}) =>
    mount(FlashcardMode, {
      props: {
        card: defaultCard,
        showAnswer: false,
        currentIndex: 0,
        total: 5,
        submitting: false,
        againCountMap: {},
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示单词名称', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('inspect');
  });

  it('显示音标', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('/ɪnˈspekt/');
  });

  it('显示词根信息', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('spect');
  });

  it('showAnswer=false 时显示"显示答案"按钮', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('显示答案');
  });

  it('点击"显示答案"触发 flip 事件', async () => {
    const wrapper = createWrapper();
    const btn = wrapper.find('.el-btn');
    await btn.trigger('click');
    expect(wrapper.emitted('flip')).toBeTruthy();
  });

  it('showAnswer=true 时显示评分按钮', () => {
    const wrapper = createWrapper({ showAnswer: true });
    expect(wrapper.text()).toContain('再来一遍');
    expect(wrapper.text()).toContain('认识');
  });

  it('showAnswer=true 时显示单词释义', () => {
    const wrapper = createWrapper({ showAnswer: true });
    expect(wrapper.text()).toContain('检查；视察');
  });

  it('点击评分按钮触发 rate 事件', async () => {
    const wrapper = createWrapper({ showAnswer: true });
    const rateBtn = wrapper.findAll('.el-btn').find((b) => b.text().includes('认识'));
    await rateBtn?.trigger('click');
    expect(wrapper.emitted('rate')).toBeTruthy();
    expect(wrapper.emitted('rate')[0]).toEqual([3]);
  });

  it('againCountMap 有值时显示复习次数', () => {
    const wrapper = createWrapper({ againCountMap: { 1: 1 } });
    expect(wrapper.text()).toContain('第 2 次复习');
  });
});