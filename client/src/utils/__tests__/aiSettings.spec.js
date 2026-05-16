import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAiSettingsSummaryMock, saveAiSettingsKeyMock, deleteAiSettingsProviderKeyMock } =
  vi.hoisted(() => ({
    getAiSettingsSummaryMock: vi.fn(),
    saveAiSettingsKeyMock: vi.fn(),
    deleteAiSettingsProviderKeyMock: vi.fn(),
  }));

vi.mock('../../api/index.js', () => ({
  getAiSettingsSummary: (...args) => getAiSettingsSummaryMock(...args),
  saveAiSettingsKey: (...args) => saveAiSettingsKeyMock(...args),
  deleteAiSettingsProviderKey: (...args) => deleteAiSettingsProviderKeyMock(...args),
}));

import {
  addCustomModel,
  clearAiSettingsServerState,
  deleteCustomModel,
  deleteCustomProvider,
  deleteProviderAiKey,
  findAiProviderById,
  getAllModels,
  getAllProviders,
  getCustomModels,
  getCustomProviders,
  loadAiSettings,
  loadProviderSettings,
  maskApiKey,
  refreshAiSettings,
  saveAiSettings,
  saveAiSettingsLocally,
  saveCustomProvider,
  subscribeAiSettingsChanges,
} from '../aiSettings.js';

const makeLocalStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    _reset: () => {
      store = {};
    },
  };
};

const localStorageMock = makeLocalStorageMock();

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock._reset();
  clearAiSettingsServerState();
  getAiSettingsSummaryMock.mockResolvedValue({ data: { providerKeys: {} } });
  saveAiSettingsKeyMock.mockResolvedValue({ data: { maskedApiKey: 'sk-t****2345' } });
  deleteAiSettingsProviderKeyMock.mockResolvedValue({});
});

describe('maskApiKey', () => {
  it('空值返回"未配置"', () => {
    expect(maskApiKey('')).toBe('未配置');
    expect(maskApiKey(null)).toBe('未配置');
    expect(maskApiKey(undefined)).toBe('未配置');
  });

  it('8位及以下返回"已配置"', () => {
    expect(maskApiKey('12345678')).toBe('已配置');
    expect(maskApiKey('abc')).toBe('已配置');
  });

  it('超过8位返回掩码格式', () => {
    expect(maskApiKey('sk-abcdefgh1234')).toBe('sk-a****1234');
  });
});

describe('providers and models', () => {
  it('返回内置厂商列表', () => {
    const providers = getAllProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((provider) => provider.id === 'deepseek')).toBe(true);
  });

  it('支持新增和查找自定义厂商', () => {
    const provider = saveCustomProvider('My Provider', 'https://example.com/v1');
    expect(findAiProviderById(provider.id)?.name).toBe('My Provider');
    expect(getCustomProviders()).toHaveLength(1);
  });

  it('删除自定义厂商时会同步清理模型', () => {
    const provider = saveCustomProvider('Local', 'http://localhost:11434/v1');
    addCustomModel(provider.id, 'llama3');
    deleteCustomProvider(provider.id);
    expect(getCustomProviders()).toEqual([]);
    expect(getCustomModels(provider.id)).toEqual([]);
  });

  it('自定义模型可增删且不会重复', () => {
    addCustomModel('deepseek', 'dup-model');
    addCustomModel('deepseek', 'dup-model');
    expect(getAllModels('deepseek').filter((model) => model === 'dup-model')).toHaveLength(1);
    deleteCustomModel('deepseek', 'dup-model');
    expect(getCustomModels('deepseek')).not.toContain('dup-model');
  });
});

describe('local settings persistence', () => {
  it('首次加载返回默认配置且不包含敏感 key', () => {
    const settings = loadAiSettings();
    expect(settings.providerId).toBe('deepseek');
    expect(settings.apiKey).toBe('');
    expect(settings.hasApiKey).toBe(false);
  });

  it('只在本地保存非敏感配置', () => {
    saveAiSettingsLocally({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-should-not-persist',
      temperature: 0.7,
    });

    const settings = loadAiSettings();
    expect(settings).toMatchObject({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.7,
      apiKey: '',
      hasApiKey: false,
    });
  });

  it('切换厂商时读取对应本地偏好', () => {
    const provider = saveCustomProvider('Remote', 'https://remote.example.com/v1');
    addCustomModel(provider.id, 'my-model');
    saveAiSettingsLocally({
      providerId: provider.id,
      providerType: 'openai-compatible',
      baseUrl: 'https://remote.example.com/v1',
      model: 'my-model',
      temperature: 0.4,
    });

    expect(loadProviderSettings(provider.id)).toMatchObject({
      providerId: provider.id,
      model: 'my-model',
      apiKey: '',
      hasApiKey: false,
    });
  });
});

describe('server-side key summary', () => {
  it('refreshAiSettings 会加载服务端密钥摘要', async () => {
    getAiSettingsSummaryMock.mockResolvedValue({
      data: { providerKeys: { openai: 'sk-o****7890' } },
    });
    saveAiSettingsLocally({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.2,
    });

    const settings = await refreshAiSettings();
    expect(settings).toMatchObject({
      providerId: 'openai',
      apiKey: '',
      hasApiKey: true,
      maskedApiKey: 'sk-o****7890',
    });
  });

  it('saveAiSettings 会把 key 发到服务端并在本地仅保留摘要', async () => {
    const settings = await saveAiSettings({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345',
      temperature: 0.5,
    });

    expect(saveAiSettingsKeyMock).toHaveBeenCalledWith({
      providerId: 'openai',
      apiKey: 'sk-test-key-12345',
    });
    expect(settings).toMatchObject({
      providerId: 'openai',
      apiKey: '',
      hasApiKey: true,
      maskedApiKey: 'sk-t****2345',
    });
    expect(loadAiSettings().apiKey).toBe('');
  });

  it('deleteProviderAiKey 会清理当前厂商的服务端密钥摘要', async () => {
    await saveAiSettings({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345',
    });

    const settings = await deleteProviderAiKey('openai');
    expect(deleteAiSettingsProviderKeyMock).toHaveBeenCalledWith('openai');
    expect(settings.hasApiKey).toBe(false);
    expect(settings.maskedApiKey).toBe('');
  });

  it('clearAiSettingsServerState 会清空内存中的服务端摘要缓存', async () => {
    await saveAiSettings({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345',
    });

    clearAiSettingsServerState();
    expect(loadAiSettings()).toMatchObject({
      hasApiKey: false,
      maskedApiKey: '',
    });
  });
});

describe('subscribeAiSettingsChanges', () => {
  it('本地配置变更后会推送刷新后的最新配置', async () => {
    getAiSettingsSummaryMock.mockResolvedValue({
      data: { providerKeys: { openai: 'sk-o****7890' } },
    });
    const handler = vi.fn();
    const unsubscribe = subscribeAiSettingsChanges(handler);

    saveAiSettingsLocally({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.2,
    });
    await flushPromises();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'openai',
        hasApiKey: true,
        maskedApiKey: 'sk-o****7890',
      })
    );

    unsubscribe();
  });
});
