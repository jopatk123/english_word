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
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
        'el-link': { template: '<a class="el-link-stub"><slot /></a>' },
        'el-checkbox': {
          props: ['modelValue', 'disabled'],
          emits: ['change'],
          template: '<label class="el-checkbox-stub" :data-checked="modelValue"><slot /></label>',
        },
        'el-select': {
          props: ['modelValue', 'loading'],
          template: '<div class="el-select-stub"><slot /></div>',
        },
        'el-option': { template: '<div />' },
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
      // 没有 existingWord 时不应渲染 el-alert（词根在此 case 不在 existingRoots 中）
      const alerts = wrapper.findAll('.el-alert-stub');
      expect(alerts.length).toBe(0);
    });
  });

  describe('添加单词无需强制先添加词根', () => {
    it('AI 建议的词根不在用户库中时，"添加单词" checkbox 仍然显示', () => {
      // existingRoots 为空 → AI 建议的 spect 不在库里，但 addWord 区域仍应渲染
      const wrapper = createWrapper(); // existingRoots: []
      const allText = wrapper.text();
      expect(allText).toContain(`添加单词「inspect」`);
    });

    it('单词已存在时不显示"添加单词" checkbox', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingWord: { id: 1, name: 'inspect', meaning: '检查', roots: [] },
      };
      const wrapper = createWrapper(wordResult);
      expect(wrapper.text()).not.toContain('添加单词「');
    });

    it('单词没有词根时"添加单词" checkbox 也应显示', () => {
      const wordResult = {
        ...defaultWordResult(),
        analysis: { ...defaultWordResult().analysis, roots: [] },
      };
      const wrapper = createWrapper(wordResult);
      expect(wrapper.text()).toContain('添加单词「inspect」');
    });
  });

  describe('已存在词根的包含/排除选项', () => {
    it('当 AI 建议词根已在用户库中时，显示"关联到此词根"的 checkbox（默认勾选）', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingRoots: [{ id: 1, name: 'spect', meaning: '看' }],
      };
      const wrapper = createWrapper(wordResult);
      const checkboxes = wrapper.findAll('.el-checkbox-stub');
      const associateCheckbox = checkboxes.find((cb) => cb.text().includes('将单词关联到此词根'));
      expect(associateCheckbox).toBeTruthy();
      // 默认 data-checked 应为 true（未被排除）
      expect(associateCheckbox.attributes('data-checked')).toBe('true');
    });

    it('当词根不在库中时，不显示关联 checkbox，而是显示"添加词根"选项', () => {
      const wrapper = createWrapper(); // existingRoots: []
      const checkboxes = wrapper.findAll('.el-checkbox-stub');
      const associateCheckbox = checkboxes.find((cb) => cb.text().includes('将单词关联到此词根'));
      expect(associateCheckbox).toBeFalsy();
      const addRootCheckbox = checkboxes.find((cb) => cb.text().includes('添加词根'));
      expect(addRootCheckbox).toBeTruthy();
    });
  });

  describe('手动选择词根', () => {
    it('当单词未存在时，手动搜索词根的下拉框应显示', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.el-select-stub').exists()).toBe(true);
    });

    it('当单词已存在时，不显示手动词根搜索框', () => {
      const wordResult = {
        ...defaultWordResult(),
        existingWord: { id: 1, name: 'inspect', meaning: '检查', roots: [] },
      };
      const wrapper = createWrapper(wordResult);
      expect(wrapper.find('.el-select-stub').exists()).toBe(false);
    });
  });

  describe('willGoToUncategorized（归入未分类提示）', () => {
    it('勾选 addWord 且无任何词根选择时，"→ 未分类" tag 应显示', async () => {
      // existingRoots 为空，所以即使 AI 建议 spect，也不会自动关联
      const wrapper = createWrapper();
      // 触发 addWord 状态
      wrapper.vm.addWord = true;
      await wrapper.vm.$nextTick();
      const tags = wrapper.findAll('.el-tag-stub');
      const uncatTag = tags.find((t) => t.text().includes('未分类'));
      expect(uncatTag).toBeTruthy();
    });

    it('当 existingRoots 已有词根且未被排除时，不显示"→ 未分类" tag', async () => {
      const wordResult = {
        ...defaultWordResult(),
        existingRoots: [{ id: 1, name: 'spect', meaning: '看' }],
      };
      const wrapper = createWrapper(wordResult);
      wrapper.vm.addWord = true;
      await wrapper.vm.$nextTick();
      const tags = wrapper.findAll('.el-tag-stub');
      const uncatTag = tags.find((t) => t.text() === '→ 未分类');
      expect(uncatTag).toBeFalsy();
    });
  });
});
