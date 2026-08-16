import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AISettingsView from '../AISettingsView.vue';

const routeMock = { fullPath: '/ai/settings' };

const {
  testAiConnectionMock,
  fetchAiModelsMock,
  elMessage,
  elMessageBox,
  loadAiSettingsMock,
  refreshAiSettingsMock,
  saveAiSettingsMock,
  saveAiSettingsLocallyMock,
  deleteProviderAiKeyMock,
  setCurrentProviderIdMock,
  loadProviderSettingsMock,
  getAllProvidersMock,
  getAllModelsMock,
  getCustomModelsMock,
  getCustomProvidersMock,
  getFetchedModelsMock,
  saveFetchedModelsMock,
  saveCustomProviderMock,
  deleteCustomProviderMock,
  addCustomModelMock,
  batchAddCustomModelsMock,
  deleteCustomModelMock,
  subscribeAiSettingsChangesMock,
  maskApiKeyMock,
  isThinkingModelMock,
  getRouteSourceMock,
  getRouteDisplayLabelMock,
} = vi.hoisted(() => ({
  testAiConnectionMock: vi.fn(),
  fetchAiModelsMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  elMessageBox: {
    confirm: vi.fn(),
  },
  loadAiSettingsMock: vi.fn(),
  refreshAiSettingsMock: vi.fn(),
  saveAiSettingsMock: vi.fn(),
  saveAiSettingsLocallyMock: vi.fn(),
  deleteProviderAiKeyMock: vi.fn(),
  setCurrentProviderIdMock: vi.fn(),
  loadProviderSettingsMock: vi.fn(),
  getAllProvidersMock: vi.fn(),
  getAllModelsMock: vi.fn(),
  getCustomModelsMock: vi.fn(),
  getCustomProvidersMock: vi.fn(),
  getFetchedModelsMock: vi.fn(),
  saveFetchedModelsMock: vi.fn(),
  saveCustomProviderMock: vi.fn(),
  deleteCustomProviderMock: vi.fn(),
  addCustomModelMock: vi.fn(),
  batchAddCustomModelsMock: vi.fn(() => 0),
  deleteCustomModelMock: vi.fn(),
  subscribeAiSettingsChangesMock: vi.fn(() => () => {}),
  maskApiKeyMock: vi.fn((value) => value || '未配置'),
  isThinkingModelMock: vi.fn(() => false),
  getRouteSourceMock: vi.fn(),
  getRouteDisplayLabelMock: vi.fn((route) =>
    route?.name === 'AIExampleSuggestion' ? '智能添加例句' : '上一步'
  ),
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
}));

vi.mock('../../api/index.js', () => ({
  testAiConnection: (...args) => testAiConnectionMock(...args),
  fetchAiModels: (...args) => fetchAiModelsMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: elMessageBox,
}));

vi.mock('../../utils/aiSettings.js', () => ({
  deleteProviderAiKey: (...args) => deleteProviderAiKeyMock(...args),
  loadAiSettings: (...args) => loadAiSettingsMock(...args),
  maskApiKey: (...args) => maskApiKeyMock(...args),
  refreshAiSettings: (...args) => refreshAiSettingsMock(...args),
  saveAiSettings: (...args) => saveAiSettingsMock(...args),
  saveAiSettingsLocally: (...args) => saveAiSettingsLocallyMock(...args),
  setCurrentProviderId: (...args) => setCurrentProviderIdMock(...args),
  loadProviderSettings: (...args) => loadProviderSettingsMock(...args),
  getAllProviders: (...args) => getAllProvidersMock(...args),
  getAllModels: (...args) => getAllModelsMock(...args),
  getCustomModels: (...args) => getCustomModelsMock(...args),
  getCustomProviders: (...args) => getCustomProvidersMock(...args),
  getFetchedModels: (...args) => getFetchedModelsMock(...args),
  saveFetchedModels: (...args) => saveFetchedModelsMock(...args),
  saveCustomProvider: (...args) => saveCustomProviderMock(...args),
  deleteCustomProvider: (...args) => deleteCustomProviderMock(...args),
  addCustomModel: (...args) => addCustomModelMock(...args),
  batchAddCustomModels: (...args) => batchAddCustomModelsMock(...args),
  deleteCustomModel: (...args) => deleteCustomModelMock(...args),
  subscribeAiSettingsChanges: (...args) => subscribeAiSettingsChangesMock(...args),
}));

vi.mock('../../utils/aiThinking.js', () => ({
  isThinkingModel: (...args) => isThinkingModelMock(...args),
}));

vi.mock('../../utils/navigationHistory.js', () => ({
  getRouteSource: (...args) => getRouteSourceMock(...args),
  getRouteDisplayLabel: (...args) => getRouteDisplayLabelMock(...args),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const baseSettings = {
  providerId: 'openai',
  providerType: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: '',
  maskedApiKey: 'sk-o****1234',
  hasApiKey: true,
  temperature: 0.2,
  skipThinking: false,
};

const globalStubs = {
  'el-breadcrumb': { template: '<nav><slot /></nav>' },
  'el-breadcrumb-item': {
    props: ['to'],
    template:
      '<a class="el-breadcrumb-item-stub" :data-path="typeof to === \'string\' ? to : to?.path"><slot /></a>',
  },
  'el-card': { template: '<section><slot name="header" /><slot /></section>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-select': { template: '<select><slot /></select>' },
  'el-option-group': { template: '<div class="option-group"><slot /></div>' },
  'el-option': {
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>',
  },
  'el-input': {
    props: ['modelValue', 'placeholder', 'showPassword'],
    emits: ['update:modelValue', 'blur'],
    template:
      '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  },
  'el-slider': { template: '<div class="slider-stub" />' },
  'el-input-number': { template: '<input class="number-stub" />' },
  'el-switch': {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<div class="switch-stub" :data-checked="String(modelValue)" @click="$emit(\'update:modelValue\', !modelValue)" />',
  },
  'el-button': {
    props: ['loading', 'type', 'link'],
    emits: ['click'],
    template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
  'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' },
  'el-checkbox': {
    props: ['modelValue', 'label', 'value', 'disabled'],
    emits: ['change', 'update:modelValue'],
    template: '<label><slot /></label>',
  },
  AiFetchModelsDialog: { template: '<div class="fetch-dialog-stub" />' },
};

describe('AISettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.fullPath = '/ai/settings';
    getRouteSourceMock.mockReturnValue(null);
    loadAiSettingsMock.mockReturnValue(baseSettings);
    refreshAiSettingsMock.mockResolvedValue(baseSettings);
    loadProviderSettingsMock.mockReturnValue(baseSettings);
    getAllProvidersMock.mockReturnValue([{ id: 'openai', name: 'OpenAI' }]);
    getAllModelsMock.mockReturnValue(['gpt-4o']);
    getCustomModelsMock.mockReturnValue([]);
    getCustomProvidersMock.mockReturnValue([]);
    getFetchedModelsMock.mockReturnValue([]);
    isThinkingModelMock.mockReturnValue(false);
    // autoFetchModels 在 mount 时会调用 fetchAiModels，给个默认空响应避免未处理的 rejection
    fetchAiModelsMock.mockResolvedValue({ data: { models: [] } });
    saveAiSettingsMock.mockResolvedValue(baseSettings);
    deleteProviderAiKeyMock.mockResolvedValue(baseSettings);
  });

  it('会把 AI 配置页的上一跳渲染成可点击面包屑', async () => {
    getRouteSourceMock.mockReturnValue({
      name: 'AIExampleSuggestion',
      fullPath: '/word/1/ai-examples',
      path: '/word/1/ai-examples',
    });

    const wrapper = mount(AISettingsView, {
      global: {
        stubs: globalStubs,
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    const breadcrumbItems = wrapper.findAll('.el-breadcrumb-item-stub');
    const previousItem = breadcrumbItems.find((item) => item.text() === '智能添加例句');

    expect(previousItem).toBeTruthy();
    expect(previousItem?.attributes('data-path')).toBe('/word/1/ai-examples');
  });

  describe('自动获取模型（显式按钮）', () => {
    const mountView = () =>
      mount(AISettingsView, {
        global: {
          stubs: globalStubs,
          mocks: { $router: { push: vi.fn() } },
        },
      });

    const findFetchButton = (wrapper) =>
      wrapper.findAll('.el-button-stub').find((b) => b.text().includes('自动获取模型'));

    it('点击按钮调用 fetchAiModels 并打开对话框', async () => {
      fetchAiModelsMock.mockResolvedValue({
        data: { models: ['gpt-4o', 'gpt-4o-mini'] },
      });

      const wrapper = mountView();
      await flushPromises();

      // mount 时 autoFetchModels 已调用一次，记录当前调用数
      const callsBefore = fetchAiModelsMock.mock.calls.length;
      const fetchBtn = findFetchButton(wrapper);
      expect(fetchBtn).toBeTruthy();
      await fetchBtn.trigger('click');
      await flushPromises();

      expect(fetchAiModelsMock.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(fetchAiModelsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          providerId: 'openai',
          baseUrl: 'https://api.openai.com/v1',
        })
      );
    });

    it('API 失败时调 ElMessage.error 并关闭对话框', async () => {
      fetchAiModelsMock.mockRejectedValue({
        response: { data: { msg: 'API Key 无效' } },
      });

      const wrapper = mountView();
      await flushPromises();

      const fetchBtn = findFetchButton(wrapper);
      await fetchBtn.trigger('click');
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalled();
      expect(elMessage.error).toHaveBeenCalledWith(expect.stringContaining('API Key 无效'));
    });

    it('未配置 baseUrl 或 apiKey 时提示警告且不调用 API', async () => {
      const noKeySettings = { ...baseSettings, apiKey: '', hasApiKey: false };
      loadAiSettingsMock.mockReturnValue(noKeySettings);
      refreshAiSettingsMock.mockResolvedValue(noKeySettings);

      const wrapper = mountView();
      await flushPromises();

      const fetchBtn = findFetchButton(wrapper);
      await fetchBtn.trigger('click');
      await flushPromises();

      expect(fetchAiModelsMock).not.toHaveBeenCalled();
      expect(elMessage.warning).toHaveBeenCalledWith(expect.stringContaining('请先填写 Base URL'));
    });
  });

  describe('静默自动拉取（autoFetchModels）', () => {
    const mountView = () =>
      mount(AISettingsView, {
        global: {
          stubs: globalStubs,
          mocks: { $router: { push: vi.fn() } },
        },
      });

    it('mount 时条件具备会自动拉取并写入 saveFetchedModels', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['gpt-4o', 'o1'] } });

      mountView();
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'openai' })
      );
      expect(saveFetchedModelsMock).toHaveBeenCalledWith('openai', ['gpt-4o', 'o1']);
    });

    it('拉取失败时静默吞错，不弹 ElMessage', async () => {
      fetchAiModelsMock.mockRejectedValue(new Error('network'));

      mountView();
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalled();
      expect(elMessage.error).not.toHaveBeenCalled();
      expect(elMessage.warning).not.toHaveBeenCalled();
    });

    it('条件不具备（无 baseUrl/apiKey）时不调 API', async () => {
      const noKeySettings = { ...baseSettings, apiKey: '', hasApiKey: false, baseUrl: '' };
      loadAiSettingsMock.mockReturnValue(noKeySettings);
      refreshAiSettingsMock.mockResolvedValue(noKeySettings);

      mountView();
      await flushPromises();

      expect(fetchAiModelsMock).not.toHaveBeenCalled();
    });

    it('切换厂商后触发 autoFetchModels', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: [] } });
      const deepseekSettings = {
        ...baseSettings,
        providerId: 'deepseek',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
      };
      loadProviderSettingsMock.mockReturnValue(deepseekSettings);

      const wrapper = mountView();
      await flushPromises();
      const callsAfterMount = fetchAiModelsMock.mock.calls.length;

      // 模拟切换厂商：触发 el-select 的 change 事件
      const select = wrapper.find('select');
      await select.trigger('change');

      await flushPromises();
      expect(fetchAiModelsMock.mock.calls.length).toBeGreaterThan(callsAfterMount);
    });
  });

  describe('跳过思考开关', () => {
    const mountView = () =>
      mount(AISettingsView, {
        global: {
          stubs: globalStubs,
          mocks: { $router: { push: vi.fn() } },
        },
      });

    it('开关初始值与 form.skipThinking 绑定', async () => {
      const wrapper = mountView();
      await flushPromises();

      const switchEl = wrapper.find('.switch-stub');
      expect(switchEl.exists()).toBe(true);
      expect(switchEl.attributes('data-checked')).toBe('false');
    });

    it('切换开关后 form.skipThinking 更新为 true', async () => {
      const wrapper = mountView();
      await flushPromises();

      const switchEl = wrapper.find('.switch-stub');
      await switchEl.trigger('click');

      expect(switchEl.attributes('data-checked')).toBe('true');
    });

    it('思考模型时 tag 类型为 warning', async () => {
      isThinkingModelMock.mockReturnValue(true);
      mountView();
      await flushPromises();

      expect(isThinkingModelMock).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'openai', model: 'gpt-4o' })
      );
    });

    it('非思考模型时 tag 类型为 info', async () => {
      isThinkingModelMock.mockReturnValue(false);
      mountView();
      await flushPromises();

      expect(isThinkingModelMock).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'openai', model: 'gpt-4o' })
      );
    });
  });

  describe('模型下拉分组与 orphan 选项', () => {
    const mountView = () =>
      mount(AISettingsView, {
        global: {
          stubs: globalStubs,
          mocks: { $router: { push: vi.fn() } },
        },
      });

    it('fetchedModels 有值时渲染"自动获取的模型"分组', async () => {
      getFetchedModelsMock.mockReturnValue(['gpt-4o', 'gpt-4o-mini']);

      const wrapper = mountView();
      await flushPromises();

      const groups = wrapper.findAll('.option-group');
      const labels = groups.map((g) => g.text());
      expect(labels.some((t) => t.includes('gpt-4o'))).toBe(true);
    });

    it('已选模型不在任何列表时仍渲染为 orphan 选项', async () => {
      getFetchedModelsMock.mockReturnValue([]);
      getCustomModelsMock.mockReturnValue([]);

      const wrapper = mountView();
      await flushPromises();

      // baseSettings.model = 'gpt-4o' 不在 fetched/custom 列表中 → orphan
      const options = wrapper.findAll('option');
      const optionTexts = options.map((o) => o.text());
      expect(optionTexts.some((t) => t.includes('gpt-4o') && t.includes('未匹配'))).toBe(true);
    });
  });

  describe('新增自定义模型', () => {
    const mountView = () =>
      mount(AISettingsView, {
        global: {
          stubs: globalStubs,
          mocks: { $router: { push: vi.fn() } },
        },
      });

    const findAddModelInput = (wrapper) =>
      wrapper.findAll('input').find((i) => i.attributes('placeholder')?.includes('llama3'));

    const findAddModelButton = (wrapper) =>
      wrapper.findAll('.el-button-stub').find((b) => b.text() === '添加');

    it('输入的模型在 fetchedModels 中时直接选中，不调 confirm', async () => {
      getFetchedModelsMock.mockReturnValue(['gpt-4o', 'o1-mini']);

      const wrapper = mountView();
      await flushPromises();

      const input = findAddModelInput(wrapper);
      expect(input).toBeTruthy();
      await input.setValue('o1-mini');

      const addBtn = findAddModelButton(wrapper);
      await addBtn.trigger('click');
      await flushPromises();

      expect(elMessageBox.confirm).not.toHaveBeenCalled();
      expect(addCustomModelMock).not.toHaveBeenCalled();
      expect(elMessage.success).toHaveBeenCalledWith(expect.stringContaining('已选择'));
    });

    it('输入的模型不在 fetchedModels 中时弹 confirm 警告', async () => {
      getFetchedModelsMock.mockReturnValue(['gpt-4o']);
      elMessageBox.confirm.mockResolvedValue('confirm');

      const wrapper = mountView();
      await flushPromises();

      const input = findAddModelInput(wrapper);
      await input.setValue('mystery-model');

      const addBtn = findAddModelButton(wrapper);
      await addBtn.trigger('click');
      await flushPromises();

      expect(elMessageBox.confirm).toHaveBeenCalledTimes(1);
      expect(addCustomModelMock).toHaveBeenCalledWith('openai', 'mystery-model');
    });

    it('用户取消 confirm 时不调 addCustomModel', async () => {
      getFetchedModelsMock.mockReturnValue(['gpt-4o']);
      elMessageBox.confirm.mockRejectedValue(new Error('cancel'));

      const wrapper = mountView();
      await flushPromises();

      const input = findAddModelInput(wrapper);
      await input.setValue('mystery-model');

      const addBtn = findAddModelButton(wrapper);
      await addBtn.trigger('click');
      await flushPromises();

      expect(addCustomModelMock).not.toHaveBeenCalled();
    });

    it('空模型名提示警告', async () => {
      const wrapper = mountView();
      await flushPromises();

      const addBtn = findAddModelButton(wrapper);
      await addBtn.trigger('click');
      await flushPromises();

      expect(elMessage.warning).toHaveBeenCalledWith(expect.stringContaining('请输入模型名称'));
    });
  });
});
