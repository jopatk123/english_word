import { mount } from '@vue/test-utils';
import SentenceAnalysisResult from '../SentenceAnalysisResult.vue';

const defaultResult = () => ({
  analysis: {
    sentence: 'She reads every day.',
    translation: '她每天阅读。',
    grammar: '主谓宾结构，uses 现在时',
    vocabulary: [
      { word: 'read', phonetic: '/riːd/', meaning: '阅读', partOfSpeech: 'v.' },
      { word: 'day', phonetic: '/deɪ/', meaning: '天', partOfSpeech: 'n.' },
    ],
  },
});

const createWrapper = (result = defaultResult()) =>
  mount(SentenceAnalysisResult, {
    props: { result },
    global: {
      stubs: {
        SpeakButton: { template: '<button class="speak-stub" />' },
        'el-card': { template: '<div><slot name="header" /><slot /></div>' },
        'el-divider': true,
        'el-table': {
          props: ['data'],
          template: '<div class="el-table-stub"><slot /></div>',
        },
        'el-table-column': {
          props: ['prop', 'label'],
          template: '<div><slot :row="{}" /></div>',
        },
      },
    },
  });

describe('SentenceAnalysisResult', () => {
  it('渲染原句文本', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('She reads every day.');
  });

  it('渲染中文翻译', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('她每天阅读。');
  });

  it('渲染语法分析', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('主谓宾结构');
  });

  it('vocabulary 不为空时渲染关键词汇区块', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('关键词汇');
  });

  it('vocabulary 为空时不渲染关键词汇区块', () => {
    const result = { analysis: { ...defaultResult().analysis, vocabulary: [] } };
    const wrapper = createWrapper(result);
    expect(wrapper.text()).not.toContain('关键词汇');
  });

  it('包含 SpeakButton 组件', () => {
    const wrapper = createWrapper();
    expect(wrapper.findAll('.speak-stub').length).toBeGreaterThan(0);
  });
});
