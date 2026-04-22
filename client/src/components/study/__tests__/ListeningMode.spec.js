import { mount } from '@vue/test-utils';
import ListeningMode from '../ListeningMode.vue';
import { globalStubs } from './studyTestUtils';

describe('ListeningMode', () => {
  const defaultCard = {
    wordId: 4,
    word: {
      name: 'construct',
      phonetic: '/kənˈstrʌkt/',
      meaning: '建造；构建',
      roots: [{ name: 'struct', meaning: '建造' }],
    },
  };
  const createWrapper = (props = {}) =>
    mount(ListeningMode, {
      props: {
        card: defaultCard,
        currentIndex: 0,
        total: 5,
        inputValue: '',
        answered: false,
        correct: false,
        hard: false,
        submitting: false,
        hint: '',
        hintLevel: 0,
        isLast: false,
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示听力模式提示文字', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('听发音，拼写单词');
  });

  it('hintLevel=0 时不显示提示层', () => {
    const wrapper = createWrapper({ hintLevel: 0, hint: 'c________ (9个字母)' });
    expect(wrapper.find('.listening-hint').exists()).toBe(false);
  });

  it('hintLevel>0 且未作答时显示提示文本', () => {
    const wrapper = createWrapper({ hintLevel: 1, hint: 'c________ (9个字母)', answered: false });
    expect(wrapper.find('.listening-hint').exists()).toBe(true);
    expect(wrapper.text()).toContain('c________ (9个字母)');
  });

  it('hintLevel>0 且已作答后不显示提示层', () => {
    const wrapper = createWrapper({ hintLevel: 1, hint: 'c________', answered: true, correct: true });
    expect(wrapper.find('.listening-hint').exists()).toBe(false);
  });

  it('unanswered 时显示确认按钮', () => {
    const wrapper = createWrapper({ answered: false });
    expect(wrapper.text()).toContain('确认');
  });

  it('answered + correct=true 显示正确提示', () => {
    const wrapper = createWrapper({ answered: true, correct: true });
    expect(wrapper.text()).toContain('正确！');
  });

  it('answered + hard=true 显示接近正确并露出释义', () => {
    const wrapper = createWrapper({ answered: true, correct: false, hard: true });
    expect(wrapper.text()).toContain('接近正确');
    expect(wrapper.text()).toContain('construct');
    expect(wrapper.text()).toContain('建造；构建');
  });

  it('answered + 完全错误时露出释义', () => {
    const wrapper = createWrapper({ answered: true, correct: false, hard: false });
    expect(wrapper.text()).toContain('正确答案');
    expect(wrapper.text()).toContain('construct');
    expect(wrapper.text()).toContain('建造；构建');
  });

  it('answered 时显示下一个按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: false });
    expect(wrapper.text()).toContain('下一个');
  });

  it('isLast=true 时显示完成按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: true });
    expect(wrapper.text()).toContain('完成');
  });

  it('显示听力模式键盘提示', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('空格');
    expect(wrapper.text()).toContain('重播发音');
  });

  it('未作答时不显示释义（保持听写语义）', () => {
    const wrapper = createWrapper({ answered: false });
    expect(wrapper.text()).not.toContain('建造；构建');
  });
});