import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AISettingsView from '../AISettingsView.vue';

const routeMock = { fullPath: '/ai/settings' };

const {
  testAiConnectionMock,
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
  saveCustomProviderMock,
  deleteCustomProviderMock,
  addCustomModelMock,
  deleteCustomModelMock,
  subscribeAiSettingsChangesMock,
  maskApiKeyMock,
  getRouteSourceMock,
  getRouteDisplayLabelMock,
} = vi.hoisted(() => ({
  testAiConnectionMock: vi.fn(),
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
  saveCustomProviderMock: vi.fn(),
  deleteCustomProviderMock: vi.fn(),
  addCustomModelMock: vi.fn(),
  deleteCustomModelMock: vi.fn(),
  subscribeAiSettingsChangesMock: vi.fn(() => () => {}),
  maskApiKeyMock: vi.fn((value) => value || '未配置'),
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
  saveCustomProvider: (...args) => saveCustomProviderMock(...args),
  deleteCustomProvider: (...args) => deleteCustomProviderMock(...args),
  addCustomModel: (...args) => addCustomModelMock(...args),
  deleteCustomModel: (...args) => deleteCustomModelMock(...args),
  subscribeAiSettingsChanges: (...args) => subscribeAiSettingsChangesMock(...args),
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
  'el-option-group': { template: '<div><slot /></div>' },
  'el-option': { template: '<option />' },
  'el-input': { template: '<input />' },
  'el-slider': { template: '<div class="slider-stub" />' },
  'el-input-number': { template: '<input class="number-stub" />' },
  'el-button': {
    props: ['loading', 'type', 'link'],
    emits: ['click'],
    template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-tag': { template: '<span><slot /></span>' },
  'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' },
};

describe('AISettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.fullPath = '/ai/settings';
    getRouteSourceMock.mockReturnValue(null);
    loadAiSettingsMock.mockReturnValue(baseSettings);
    refreshAiSettingsMock.mockResolvedValue(baseSettings);
    loadProviderSettingsMock.mockReturnValue(baseSettings);
    getAllProvidersMock.mockReturnValue([{ id: 'openai', name: 'OpenAI', models: ['gpt-4o'] }]);
    getAllModelsMock.mockReturnValue(['gpt-4o']);
    getCustomModelsMock.mockReturnValue([]);
    getCustomProvidersMock.mockReturnValue([]);
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
});