import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WordDetailView from '../WordDetailView.vue';

const routeMock = { params: { id: '1' } };

const {
  getWordMock,
  getExamplesMock,
  getRootsMock,
  createWordMock,
  updateWordMock,
  deleteWordMock,
  createExampleMock,
  updateExampleMock,
  deleteExampleMock,
  getAiExampleSuggestionsMock,
  elMessage,
  elMessageBox,
  loadAiSettingsMock,
  isAiSettingsReadyMock,
  subscribeAiSettingsChangesMock,
} = vi.hoisted(() => ({
  getWordMock: vi.fn(),
  getExamplesMock: vi.fn(),
  getRootsMock: vi.fn(),
  createWordMock: vi.fn(),
  updateWordMock: vi.fn(),
  deleteWordMock: vi.fn(),
  createExampleMock: vi.fn(),
  updateExampleMock: vi.fn(),
  deleteExampleMock: vi.fn(),
  getAiExampleSuggestionsMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  elMessageBox: {
    confirm: vi.fn(),
  },
  loadAiSettingsMock: vi.fn(),
  isAiSettingsReadyMock: vi.fn(),
  subscribeAiSettingsChangesMock: vi.fn(() => () => {}),
}));

const routerMock = { push: vi.fn() };

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

vi.mock('../../api/index.js', () => ({
  getWord: (...args) => getWordMock(...args),
  getExamples: (...args) => getExamplesMock(...args),
  getRoots: (...args) => getRootsMock(...args),
  createWord: (...args) => createWordMock(...args),
  updateWord: (...args) => updateWordMock(...args),
  deleteWord: (...args) => deleteWordMock(...args),
  createExample: (...args) => createExampleMock(...args),
  updateExample: (...args) => updateExampleMock(...args),
  deleteExample: (...args) => deleteExampleMock(...args),
  getAiExampleSuggestions: (...args) => getAiExampleSuggestionsMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: elMessageBox,
}));

vi.mock('../../utils/aiSettings.js', () => ({
  loadAiSettings: (...args) => loadAiSettingsMock(...args),
  isAiSettingsReady: (...args) => isAiSettingsReadyMock(...args),
  subscribeAiSettingsChanges: (...args) => subscribeAiSettingsChangesMock(...args),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const globalStubs = {
  SpeakButton: { template: '<button class="speak-stub" />' },
  'el-breadcrumb': { template: '<div><slot /></div>' },
  'el-breadcrumb-item': { template: '<div><slot /></div>' },
  'el-card': { template: '<div><slot name="header" /><slot /></div>' },
  'el-link': { template: '<a><slot /></a>' },
  'el-tag': { template: '<span><slot /></span>' },
  'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-input': { template: '<input />' },
  'el-select': {
    props: ['modelValue', 'loading', 'placeholder', 'filterable', 'clearable', 'noDataText'],
    emits: ['update:modelValue'],
    template: `
      <select
        class="el-select"
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value ? Number($event.target.value) : null)"
      >
        <slot />
      </select>
    `,
  },
  'el-option': {
    props: ['label', 'value'],
    template: '<option class="el-option" :value="value">{{ label }}</option>',
  },
  'el-button': {
    props: ['disabled', 'loading', 'type', 'link'],
    emits: ['click'],
    template:
      '<button class="el-btn" :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>',
  },
};

const mountedWrappers = [];

const baseWord = {
  id: 1,
  name: 'stable',
  meaning: '稳定的',
  phonetic: '/ˈsteɪbəl/',
  remark: '词根测试',
  roots: [{ id: 7, name: 'sta', meaning: '站立' }],
};

const baseExamples = [
  { id: 11, sentence: 'The table is stable.', translation: '这张桌子很稳。', remark: '保留备注' },
  { id: 12, sentence: 'Prices remained stable.', translation: '价格保持稳定。', remark: '' },
];

async function createWrapper() {
  getWordMock.mockResolvedValue({ data: baseWord });
  getExamplesMock.mockResolvedValue({ data: baseExamples });
  getRootsMock.mockResolvedValue({
    data: [
      { id: 7, name: 'sta', meaning: '站立' },
      { id: 8, name: 'termin', meaning: '结束' },
    ],
  });
  loadAiSettingsMock.mockReturnValue({ providerId: 'openai', model: 'gpt-test' });
  isAiSettingsReadyMock.mockReturnValue(true);
  updateExampleMock.mockResolvedValue({});
  updateWordMock.mockResolvedValue({});
  deleteWordMock.mockResolvedValue({});
  createWordMock.mockResolvedValue({ msg: '添加成功' });

  const wrapper = mount(WordDetailView, {
    props: { id: '1' },
    global: {
      stubs: globalStubs,
      mocks: {
        $router: { push: vi.fn() },
      },
      directives: {
        loading: {
          mounted() {},
          updated() {},
        },
      },
    },
  });

  mountedWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

describe('WordDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.params.id = '1';
  });

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount();
    }
  });

  it('重新生成时会排除当前已有例句并覆盖当前例句', async () => {
    getAiExampleSuggestionsMock.mockResolvedValue({
      data: {
        items: [
          { sentence: 'The market looks stable now.', translation: '现在市场看起来稳定了。' },
        ],
      },
    });

    const wrapper = await createWrapper();
    const regenerateButton = wrapper
      .findAll('.el-btn')
      .find((button) => button.text().includes('重新生成'));

    await regenerateButton.trigger('click');
    await flushPromises();

    expect(getAiExampleSuggestionsMock).toHaveBeenCalledWith(
      '1',
      { providerId: 'openai', model: 'gpt-test' },
      {
        excludedSentences: ['The table is stable.', 'Prices remained stable.'],
      }
    );
    expect(updateExampleMock).toHaveBeenCalledWith(11, {
      sentence: 'The market looks stable now.',
      translation: '现在市场看起来稳定了。',
      remark: '保留备注',
    });
    expect(getExamplesMock).toHaveBeenCalledTimes(2);
    expect(elMessage.success).toHaveBeenCalledWith('已重新生成该例句');
  });

  it('AI 首次返回重复例句时会自动重试并使用不重复结果', async () => {
    getAiExampleSuggestionsMock
      .mockResolvedValueOnce({
        data: {
          items: [{ sentence: 'The table is stable.', translation: '这张桌子很稳。' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ sentence: 'Her condition is stable.', translation: '她的情况很稳定。' }],
        },
      });

    const wrapper = await createWrapper();
    const regenerateButton = wrapper
      .findAll('.el-btn')
      .find((button) => button.text().includes('重新生成'));

    await regenerateButton.trigger('click');
    await flushPromises();

    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(2);
    expect(getAiExampleSuggestionsMock).toHaveBeenNthCalledWith(
      2,
      '1',
      { providerId: 'openai', model: 'gpt-test' },
      {
        excludedSentences: ['The table is stable.', 'Prices remained stable.'],
      }
    );
    expect(updateExampleMock).toHaveBeenCalledWith(11, {
      sentence: 'Her condition is stable.',
      translation: '她的情况很稳定。',
      remark: '保留备注',
    });
  });

  it('可以把当前单词添加到已有词根中', async () => {
    const wrapper = await createWrapper();
    wrapper.vm.setWordForTest(baseWord);
    wrapper.vm.setSelectedRootIdForTest(8);
    await wrapper.vm.handleAddRoot();
    await flushPromises();

    expect(createWordMock).toHaveBeenCalledWith({
      name: 'stable',
      meaning: '稳定的',
      phonetic: '/ˈsteɪbəl/',
      remark: '词根测试',
      rootId: 8,
    });
    expect(getWordMock).toHaveBeenCalledTimes(2);
    expect(elMessage.success).toHaveBeenCalledWith('添加成功');
  });

  it('删除多个词根中的一个时只更新剩余关联', async () => {
    const wrapper = await createWrapper();
    wrapper.vm.setWordForTest({
      ...baseWord,
      roots: [
        { id: 7, name: 'sta', meaning: '站立' },
        { id: 8, name: 'termin', meaning: '结束' },
      ],
    });
    wrapper.vm.setSelectedDeleteRootIdForTest(8);
    await wrapper.vm.handleDeleteRoot();

    expect(elMessageBox.confirm).toHaveBeenCalled();
    expect(updateWordMock).toHaveBeenCalledWith('1', {
      name: 'stable',
      meaning: '稳定的',
      phonetic: '/ˈsteɪbəl/',
      remark: '词根测试',
      rootIds: [7],
    });
    expect(deleteWordMock).not.toHaveBeenCalled();
    expect(getWordMock).toHaveBeenCalledTimes(2);
    expect(elMessage.success).toHaveBeenCalledWith('删除成功');
  });

  it('删除最后一个词根时会同步删除单词和例句', async () => {
    const wrapper = await createWrapper();
    wrapper.vm.setWordForTest({
      ...baseWord,
      roots: [{ id: 7, name: 'sta', meaning: '站立' }],
    });
    wrapper.vm.setSelectedDeleteRootIdForTest(7);
    await wrapper.vm.handleDeleteRoot();

    expect(elMessageBox.confirm).toHaveBeenCalled();
    expect(deleteWordMock).toHaveBeenCalledWith('1');
    expect(updateWordMock).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(elMessage.success).toHaveBeenCalledWith('删除成功，单词和例句已同步删除');
  });
});
