import { mount } from '@vue/test-utils';
import WordAnalysisResult from '../WordAnalysisResult.vue';

const defaultWordResult = () => ({
  analysis: {
    word: 'inspect',
    phonetic: '/ɪnˈspekt/',
    meaning: '检查；视察',
    partOfSpeech: [{ type: 'v.', meaning: '检查' }],
    roots: [{ name: 'spect', meaning: '看' }],
    examples: [
      { sentence: 'She inspects the room every day.', translation: '她每天检查房间。' },
      { sentence: 'The officer inspected the building.', translation: '官员检查了这栋楼。' },
    ],
  },
  existingWord: null,
  existingRoots: [],
});

const createWrapper = (wordResult = defaultWordResult()) => {
  return mount(WordAnalysisResult, {
    props: { wordResult },
    global: {
      stubs: {
        SpeakButton: { template: '<button class="speak-stub" />' },
        'el-card': { template: '<div><slot name="header" /><slot /></div>' },
        'el-alert': { template: '<div class="el-alert-stub"><slot name="title" /></div>' },
        'el-divider': true,
        'el-tag': { template: '<span><slot /></span>' },
        'el-link': { template: '<a class="el-link-stub"><slot /></a>' },
        'el-checkbox': { template: '<label><slot /></label>' },
        'el-button': {
          emits: ['click'],
          template: '<button class="regen-btn" @click="$emit(\'click\')"><slot /></button>',
        },
      },
      mocks: {
        $router: { push: vi.fn() },
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

  describe('单词已存在提示', () => {
    it('单词已存在时显示提示', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingWord: {
          id: 1,
          name: 'inspect',
          meaning: '检查',
          roots: [{ id: 10, name: 'spect', meaning: '看' }],
        },
      };
      const wrapper = createWrapper(wordResult);
      const alert = wrapper.find('.el-alert-stub');
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toContain('inspect');
    });

    it('关联词根名称正确渲染（修复 template v-for 问题）', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingWord: {
          id: 1,
          name: 'embarrassment',
          meaning: '尴尬',
          roots: [
            { id: 10, name: 'em-', meaning: '使进入…状态' },
            { id: 11, name: 'barr', meaning: '障碍' },
          ],
        },
      };
      const wrapper = createWrapper(wordResult);
      const links = wrapper.findAll('.el-link-stub');
      // 提示区里应找到两个词根链接
      const linkTexts = links.map((l) => l.text());
      expect(linkTexts).toContain('em-');
      expect(linkTexts).toContain('barr');
    });

    it('无词根时关联词根区域为空但不报错', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingWord: {
          id: 2,
          name: 'run',
          meaning: '跑',
          roots: [],
        },
      };
      expect(() => createWrapper(wordResult)).not.toThrow();
      const wrapper = createWrapper(wordResult);
      expect(wrapper.find('.el-alert-stub').exists()).toBe(true);
    });

    it('单词不存在时不显示已存在提示', () => {
      const wrapper = createWrapper();
      // 没有 existingWord 时不应渲染 el-alert
      const alerts = wrapper.findAll('.el-alert-stub');
      expect(alerts.length).toBe(0);
    });
  });
});
