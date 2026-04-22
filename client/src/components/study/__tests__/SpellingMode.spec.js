import { mount } from '@vue/test-utils';
import SpellingMode from '../SpellingMode.vue';
import { globalStubs } from './studyTestUtils';

describe('SpellingMode', () => {
  const defaultCard = {
    wordId: 3,
    word: {
      name: 'construct',
      phonetic: '/kənˈstrʌkt/',
      meaning: '建造；构建',
      roots: [{ name: 'struct', meaning: '建造' }],
    },
  };

  const createWrapper = (props = {}) =>
    mount(SpellingMode, {
      props: {
        card: defaultCard,
        currentIndex: 0,
        total: 5,
        inputValue: '',
        answered: false,
        correct: false,
        hard: false,
        submitting: false,
        spellingHint: '输入单词拼写...',
        isLast: false,
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示单词释义', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('建造；构建');
  });

  it('显示词根信息', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('struct');
  });

  it('unanswered 时显示确认按钮', () => {
    const wrapper = createWrapper({ answered: false });
    expect(wrapper.text()).toContain('确认');
  });

  it('answered + correct=true 显示正确提示', () => {
    const wrapper = createWrapper({ answered: true, correct: true, inputValue: 'construct' });
    expect(wrapper.text()).toContain('正确');
  });

  it('answered + correct=false 显示错误提示和正确答案', () => {
    const wrapper = createWrapper({ answered: true, correct: false, inputValue: 'constrct' });
    expect(wrapper.text()).toContain('正确答案');
    expect(wrapper.text()).toContain('construct');
  });

  it('answered + hard=true 显示接近正确提示', () => {
    const wrapper = createWrapper({
      answered: true,
      correct: false,
      hard: true,
      inputValue: 'constract',
    });
    expect(wrapper.text()).toContain('接近正确');
    expect(wrapper.text()).toContain('construct');
  });

  it('answered + hard=false + correct=false 显示完全错误提示', () => {
    const wrapper = createWrapper({
      answered: true,
      correct: false,
      hard: false,
      inputValue: 'xyz',
    });
    expect(wrapper.text()).toContain('正确答案');
    expect(wrapper.text()).not.toContain('接近正确');
  });

  it('answered 时显示下一个按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: false });
    expect(wrapper.text()).toContain('下一个');
  });

  it('isLast=true 时显示完成按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: true });
    expect(wrapper.text()).toContain('完成');
  });

  it('不显示听力模式相关内容', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).not.toContain('听发音，拼写单词');
    expect(wrapper.find('.listening-hint').exists()).toBe(false);
  });

  it('spellingHint 文本作为输入框占位符', () => {
    const wrapper = createWrapper({ spellingHint: 'c________ (9个字母)' });
    const input = wrapper.find('input');
    expect(input.attributes('placeholder')).toBe('c________ (9个字母)');
  });
});