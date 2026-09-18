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
      global: {
        stubs: { ...globalStubs, WordImage: { template: '<div class="word-image-stub" />' } },
      },
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

  it('showAnswer=false 时提示点击卡片翻牌', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('点击或左右滑动显示答案');
    expect(wrapper.text()).not.toContain('再来一遍');
  });

  it('左右滑动触发翻牌', async () => {
    const wrapper = createWrapper();
    await wrapper.find('.flashcard').trigger('touchstart', {
      changedTouches: [{ clientX: 180, clientY: 40 }],
    });
    await wrapper.find('.flashcard').trigger('touchend', {
      changedTouches: [{ clientX: 40, clientY: 44 }],
    });
    expect(wrapper.emitted('flip')).toBeTruthy();
  });

  it('已翻开时右滑评分为认识', async () => {
    const wrapper = createWrapper({ showAnswer: true });
    await wrapper.find('.flashcard').trigger('touchstart', {
      changedTouches: [{ clientX: 40, clientY: 40 }],
    });
    await wrapper.find('.flashcard').trigger('touchend', {
      changedTouches: [{ clientX: 180, clientY: 42 }],
    });
    expect(wrapper.emitted('rate')[0]).toEqual([3]);
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

  it('showAnswer=true 时显示全部例句', () => {
    const wrapper = createWrapper({
      showAnswer: true,
      card: {
        ...defaultCard,
        word: {
          ...defaultCard.word,
          examples: [
            { id: 1, sentence: 'She inspects the room.', translation: '她检查房间。' },
            {
              id: 2,
              sentence: 'He inspected the engine carefully.',
              translation: '他仔细检查了发动机。',
            },
            {
              id: 3,
              sentence: 'The teacher inspected our homework.',
              translation: '老师检查了我们的作业。',
            },
          ],
        },
      },
    });

    const examples = wrapper.findAll('.card-example');

    expect(examples).toHaveLength(3);
    expect(wrapper.text()).toContain('He inspected the engine carefully.');
    expect(wrapper.text()).toContain('The teacher inspected our homework.');
  });

  it('点击评分按钮触发 rate 事件', async () => {
    const wrapper = createWrapper({ showAnswer: true });
    const rateBtn = wrapper.findAll('.el-btn').find((b) => b.text().includes('认识'));
    await rateBtn?.trigger('click');
    expect(wrapper.emitted('rate')).toBeTruthy();
    expect(wrapper.emitted('rate')[0]).toEqual([3]);
  });

  it('每条例句都渲染「重新生成」按钮', () => {
    const wrapper = createWrapper({ showAnswer: true });
    const buttons = wrapper.findAll('.example-regenerate');

    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe('重新生成');
  });

  it('点击「重新生成」抛出对应例句', async () => {
    const example = { id: 7, sentence: 'She inspects the room.', translation: '她检查房间。' };
    const wrapper = createWrapper({
      showAnswer: true,
      card: { ...defaultCard, word: { ...defaultCard.word, examples: [example] } },
    });

    await wrapper.find('.example-regenerate').trigger('click');

    expect(wrapper.emitted('regenerate-example')).toBeTruthy();
    expect(wrapper.emitted('regenerate-example')[0]).toEqual([example]);
  });

  it('regeneratingExampleId 匹配时按钮处于加载态', () => {
    const wrapper = createWrapper({ showAnswer: true, regeneratingExampleId: 1 });

    expect(wrapper.find('.example-regenerate').attributes('data-loading')).toBe('true');
  });

  it('againCountMap 有值时显示复习次数', () => {
    const wrapper = createWrapper({ againCountMap: { 1: 1 } });
    expect(wrapper.text()).toContain('第 2 次复习');
  });

  it('单词有记忆图片时未翻牌也展示', () => {
    const wrapper = createWrapper({
      card: {
        ...defaultCard,
        word: { ...defaultCard.word, hasImage: true },
      },
    });
    expect(wrapper.find('.word-image-stub').exists()).toBe(true);
  });

  it('未上传记忆图片时不展示图片占位', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.word-image-stub').exists()).toBe(false);
  });
});
