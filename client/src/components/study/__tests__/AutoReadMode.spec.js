import { mount } from '@vue/test-utils';
import AutoReadMode from '../AutoReadMode.vue';
import { globalStubs } from './studyTestUtils';

describe('AutoReadMode', () => {
  const defaultCard = {
    wordId: 1,
    word: {
      id: 1,
      name: 'resolution',
      phonetic: '/ˌrezəˈluːʃn/',
      meaning: '决心；分辨率；解决',
      examples: [
        { id: 1, sentence: "She made a New Year's resolution.", translation: '她立下了新年决心。' },
      ],
    },
  };

  const createWrapper = (props = {}) =>
    mount(AutoReadMode, {
      props: {
        card: defaultCard,
        ...props,
      },
      global: {
        stubs: {
          ...globalStubs,
          WordImage: { template: '<div class="word-image-stub" />' },
        },
      },
    });

  it('自动朗读模式显示单词释义', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('决心；分辨率；解决');
    expect(wrapper.text()).toContain('resolution');
  });

  it('没有释义时显示兜底文案', () => {
    const wrapper = createWrapper({
      card: { ...defaultCard, word: { ...defaultCard.word, meaning: '' } },
    });
    expect(wrapper.text()).toContain('暂无释义');
  });

  it('有记忆图片时会展示图片', () => {
    const wrapper = createWrapper({
      card: {
        ...defaultCard,
        word: { ...defaultCard.word, hasImage: true },
      },
    });
    expect(wrapper.find('.word-image-stub').exists()).toBe(true);
  });
});
