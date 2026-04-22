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
      examples: [{ id: 1, sentence: "She made a New Year's resolution.", translation: '她立下了新年决心。' }],
    },
  };

  const createWrapper = (props = {}) =>
    mount(AutoReadMode, {
      props: {
        card: defaultCard,
        currentIndex: 0,
        total: 5,
        ...props,
      },
      global: {
        stubs: {
          ...globalStubs,
          SessionProgress: { template: '<div class="progress-stub" />' },
        },
      },
    });

  it('自动朗读模式显示单词释义', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('决心；分辨率；解决');
    expect(wrapper.text()).not.toContain('自动朗读中');
  });

  it('没有释义时显示兜底文案', () => {
    const wrapper = createWrapper({ card: { ...defaultCard, word: { ...defaultCard.word, meaning: '' } } });
    expect(wrapper.text()).toContain('暂无释义');
  });
});