import { mount } from '@vue/test-utils';
import ChoiceMode from '../ChoiceMode.vue';
import { globalStubs } from './studyTestUtils';

describe('ChoiceMode', () => {
  const defaultCard = {
    wordId: 2,
    word: { id: 2, name: 'transport', phonetic: '/trænsˈpɔːrt/', meaning: '运输' },
  };

  const options = [
    { id: 2, meaning: '运输' },
    { id: 3, meaning: '检查' },
    { id: 4, meaning: '分析' },
    { id: 5, meaning: '创造' },
  ];

  const createWrapper = (props = {}) =>
    mount(ChoiceMode, {
      props: {
        card: defaultCard,
        choiceOptions: options,
        choiceSelected: -1,
        choiceAnswered: false,
        submitting: false,
        currentIndex: 0,
        total: 5,
        isLast: false,
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示单词名称', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('transport');
  });

  it('显示 4 个选项', () => {
    const wrapper = createWrapper();
    expect(wrapper.findAll('.choice-option')).toHaveLength(4);
  });

  it('点击选项触发 choose 事件', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.choice-option')[0].trigger('click');
    expect(wrapper.emitted('choose')).toBeTruthy();
    expect(wrapper.emitted('choose')[0]).toEqual([0]);
  });

  it('choiceAnswered=true 时已答题不再触发选择', async () => {
    const wrapper = createWrapper({ choiceAnswered: true });
    await wrapper.findAll('.choice-option')[0].trigger('click');
    expect(wrapper.emitted('choose')).toBeFalsy();
  });

  it('非末尾题时按钮显示"下一个"', () => {
    const wrapper = createWrapper({ choiceAnswered: true, isLast: false });
    expect(wrapper.text()).toContain('下一个');
  });

  it('isLast=true 时按钮显示"完成"', () => {
    const wrapper = createWrapper({ choiceAnswered: true, isLast: true });
    expect(wrapper.text()).toContain('完成');
  });
});