import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchView from '../SearchView.vue';

const routeMock = { query: {} };

const {
  analyzeWordMock,
  analyzeSentenceMock,
  loadAiSettingsMock,
  isAiSettingsReadyMock,
  getProviderByIdMock,
  speakMock,
  elMessage,
} = vi.hoisted(() => ({
  analyzeWordMock: vi.fn(),
  analyzeSentenceMock: vi.fn(),
  loadAiSettingsMock: vi.fn(),
  isAiSettingsReadyMock: vi.fn(),
  getProviderByIdMock: vi.fn(),
  speakMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
}));

vi.mock('../../api/index.js', () => ({
  analyzeWord: (...args) => analyzeWordMock(...args),
  analyzeSentence: (...args) => analyzeSentenceMock(...args),
}));

vi.mock('../../utils/aiSettings.js', () => ({
  loadAiSettings: (...args) => loadAiSettingsMock(...args),
  isAiSettingsReady: (...args) => isAiSettingsReadyMock(...args),
}));

vi.mock('../../constants/aiProviders.js', () => ({
  getProviderById: (...args) => getProviderByIdMock(...args),
}));

vi.mock('../../utils/speech.js', () => ({
  useSpeech: () => ({ speak: speakMock }),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const globalStubs = {
  WordAnalysisResult: { template: '<div class="word-result-stub" />' },
  SentenceAnalysisResult: { template: '<div class="sentence-result-stub" />' },
  Search: { template: '<i class="search-icon-stub" />' },
  'el-breadcrumb': { template: '<div><slot /></div>' },
  'el-breadcrumb-item': { template: '<div><slot /></div>' },
  'el-card': { template: '<section><slot name="header" /><slot /></section>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-alert': { template: '<div class="el-alert-stub"><slot /></div>' },
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
  'el-icon': { template: '<span class="el-icon-stub"><slot /></span>' },
  'el-input': {
    props: ['modelValue'],
    emits: ['update:modelValue', 'clear'],
    template:
      '<div class="el-input-stub"><input class="el-input-inner" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot name="prefix" /><slot name="append" /></div>',
  },
  'el-button': {
    props: ['loading'],
    emits: ['click'],
    template: '<button class="el-btn" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>',
  },
};

const mountedWrappers = [];

async function createWrapper() {
  loadAiSettingsMock.mockReturnValue({ providerId: 'openai', model: 'gpt-test' });
  isAiSettingsReadyMock.mockReturnValue(true);
  getProviderByIdMock.mockReturnValue({ name: 'OpenAI' });

  const wrapper = mount(SearchView, {
    global: {
      stubs: globalStubs,
    },
  });

  mountedWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.query = {};
  });

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount();
    }
  });

  it('单词搜索成功后会自动朗读一次', async () => {
    analyzeWordMock.mockResolvedValue({
      data: {
        analysis: {
          word: 'engine',
          phonetic: '/ˈendʒɪn/',
          meaning: '发动机',
          partOfSpeech: [],
          roots: [],
          examples: [],
        },
      },
    });

    const wrapper = await createWrapper();
    await wrapper.find('input.el-input-inner').setValue('Engine');
    await wrapper.find('.el-btn').trigger('click');
    await flushPromises();

    expect(analyzeWordMock).toHaveBeenCalledWith('Engine', {
      providerId: 'openai',
      model: 'gpt-test',
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('engine');
  });

  it('句子搜索成功后不会自动朗读', async () => {
    analyzeSentenceMock.mockResolvedValue({
      data: {
        sentence: 'This is a test sentence.',
        meaning: '这是一个测试句子。',
      },
    });

    const wrapper = await createWrapper();
    await wrapper.find('input.el-input-inner').setValue('This is a test sentence.');
    await wrapper.find('.el-btn').trigger('click');
    await flushPromises();

    expect(analyzeSentenceMock).toHaveBeenCalledWith('This is a test sentence.', {
      providerId: 'openai',
      model: 'gpt-test',
    });
    expect(speakMock).not.toHaveBeenCalled();
  });
});