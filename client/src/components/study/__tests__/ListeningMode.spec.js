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
      examples: [
        { id: 1, sentence: 'They plan to construct a new bridge.', translation: '他们计划建一座新桥。' },
        { id: 2, sentence: 'The team will construct the model together.', translation: '团队会一起搭建这个模型。' },
      ],
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

  it('默认不显示例句中文翻译', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).not.toContain('他们计划建一座新桥。');
    expect(wrapper.text()).not.toContain('团队会一起搭建这个模型。');
  });

  it('有例句时显示例句发音入口', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('播放例句 1/2');
    expect(wrapper.text()).toContain('换一句');
  });

  it('点击播放例句后显示当前例句中文翻译', async () => {
    const wrapper = createWrapper();
    const buttons = wrapper.findAll('.el-btn');
    const playButton = buttons.find((button) => button.text() === '播放例句 1/2');
    await playButton.trigger('click');
    expect(wrapper.text()).toContain('他们计划建一座新桥。');
  });

  it('切换例句后更新当前例句编号', async () => {
    const wrapper = createWrapper();
    const buttons = wrapper.findAll('.el-btn');
    const cycleButton = buttons.find((button) => button.text() === '换一句');
    await cycleButton.trigger('click');
    expect(wrapper.text()).toContain('播放例句 2/2');
    expect(wrapper.text()).toContain('团队会一起搭建这个模型。');
  });

  it('没有例句时显示空状态提示', () => {
    const wrapper = createWrapper({
      card: {
        ...defaultCard,
        word: {
          ...defaultCard.word,
          examples: [],
        },
      },
    });
    expect(wrapper.text()).toContain('当前单词暂无例句音频');
    expect(wrapper.text()).not.toContain('播放例句');
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