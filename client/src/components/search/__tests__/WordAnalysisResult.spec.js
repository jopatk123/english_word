import { mount } from '@vue/test-utils';
import WordAnalysisResult from '../WordAnalysisResult.vue';

const createWrapper = (overrides = {}) => {
  const wordResult = {
    analysis: {
      word: 'inspect',
      phonetic: '/ɪnˈspekt/',
      meaning: '检查；视察',
      partOfSpeech: [{ type: 'v.', meaning: '检查' }],
      roots: [],
      examples: [
        { sentence: 'She inspects the room every day.', translation: '她每天检查房间。' },
        { sentence: 'The officer inspected the building.', translation: '官员检查了这栋楼。' },
      ],
    },
    existingWord: null,
    existingRoots: [],
  };

  return mount(WordAnalysisResult, {
    props: {
      wordResult,
      ...overrides,
    },
    global: {
      stubs: {
        SpeakButton: { template: '<button class="speak-stub" />' },
        'el-card': { template: '<div><slot name="header" /><slot /></div>' },
        'el-alert': { template: '<div><slot name="title" /></div>' },
        'el-divider': true,
        'el-tag': { template: '<span><slot /></span>' },
        'el-link': { template: '<a><slot /></a>' },
        'el-checkbox': { template: '<label><slot /></label>' },
        'el-button': {
          emits: ['click'],
          template: '<button class="regen-btn" @click="$emit(\'click\')"><slot /></button>',
        },
      },
      mocks: {
        $router: {
          push: vi.fn(),
        },
      },
    },
  });
};

describe('WordAnalysisResult', () => {
  it('点击重新生成会抛出对应索引事件', async () => {
    const wrapper = createWrapper();
    const regenerateButtons = wrapper.findAll('.regen-btn');

    expect(regenerateButtons.length).toBeGreaterThanOrEqual(2);

    await regenerateButtons[1].trigger('click');

    expect(wrapper.emitted('regenerate-example')).toEqual([[{ index: 1 }]]);
  });
});
