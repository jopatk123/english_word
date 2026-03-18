import { DEFAULT_PROVIDER_ID, getProviderById } from '../constants/aiProviders.js';

export const AI_SETTINGS_STORAGE_KEY = 'english-word-ai-settings';

/**
 * 创建默认的单个提供者配置
 */
export const createDefaultAiSettings = () => {
  const provider = getProviderById(DEFAULT_PROVIDER_ID);
  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: provider.models[0],
    apiKey: '',
  };
};

/**
 * 获取localStorage中的完整配置对象
 * 结构: { currentProviderId: 'xxx', providers: { openai: {...}, anthropic: {...} } }
 */
const getAllAiSettings = () => {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        currentProviderId: DEFAULT_PROVIDER_ID,
        providers: {},
      };
    }
    
    const parsed = JSON.parse(raw);
    return {
      currentProviderId: parsed?.currentProviderId || DEFAULT_PROVIDER_ID,
      providers: parsed?.providers || {},
    };
  } catch {
    return {
      currentProviderId: DEFAULT_PROVIDER_ID,
      providers: {},
    };
  }
};

/**
 * 保存完整的配置对象到localStorage
 */
const saveAllAiSettings = (allSettings) => {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(allSettings));
};

/**
 * 规范化单个提供者的配置
 */
const normalizeProviderSettings = (settings) => {
  const provider = getProviderById(settings.providerId);
  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: settings.baseUrl?.trim() || provider.baseUrl,
    model: provider.models.includes(settings.model) ? settings.model : provider.models[0],
    apiKey: settings.apiKey?.trim() || '',
  };
};

/**
 * 加载当前选中提供者的配置
 */
export const loadAiSettings = () => {
  const allSettings = getAllAiSettings();
  const currentProviderId = allSettings.currentProviderId;
  const provider = getProviderById(currentProviderId);

  // 如果该提供者已保存过配置，使用已保存的配置；否则使用默认配置
  const saved = allSettings.providers[currentProviderId];
  if (saved) {
    return {
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: saved.baseUrl || provider.baseUrl,
      model: provider.models.includes(saved.model) ? saved.model : provider.models[0],
      apiKey: saved.apiKey || '',
    };
  }

  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: provider.models[0],
    apiKey: '',
  };
};

/**
 * 保存当前选中提供者的配置
 */
export const saveAiSettings = (settings) => {
  const normalized = normalizeProviderSettings(settings);
  const allSettings = getAllAiSettings();
  
  // 保存到该提供者的配置
  allSettings.providers[normalized.providerId] = {
    baseUrl: normalized.baseUrl,
    model: normalized.model,
    apiKey: normalized.apiKey,
  };
  
  // 更新当前选中的提供者
  allSettings.currentProviderId = normalized.providerId;
  
  saveAllAiSettings(allSettings);
  return normalized;
};

/**
 * 切换当前使用的提供者，并加载该提供者的配置
 */
export const setCurrentProviderId = (providerId) => {
  const provider = getProviderById(providerId);
  const allSettings = getAllAiSettings();
  allSettings.currentProviderId = providerId;
  saveAllAiSettings(allSettings);
};

/**
 * 获取当前选中的提供者ID
 */
export const getCurrentProviderId = () => {
  const allSettings = getAllAiSettings();
  return allSettings.currentProviderId;
};

/**
 * 加载特定提供者的配置（用于切换提供者时）
 */
export const loadProviderSettings = (providerId) => {
  const provider = getProviderById(providerId);
  const allSettings = getAllAiSettings();

  // 如果该提供者已保存过配置，使用已保存的配置；否则使用默认配置
  const saved = allSettings.providers[providerId];
  if (saved && saved.apiKey) {
    // 如果已保存过API Key，使用已保存的配置
    return {
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: saved.baseUrl || provider.baseUrl,
      model: provider.models.includes(saved.model) ? saved.model : provider.models[0],
      apiKey: saved.apiKey,
    };
  }

  // 否则返回默认配置（API Key为空）
  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: provider.models[0],
    apiKey: '',
  };
};

export const maskApiKey = (apiKey) => {
  if (!apiKey) return '未配置';
  if (apiKey.length <= 8) return '已配置';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

export const isAiSettingsReady = (settings) => Boolean(
  settings?.providerId && settings?.providerType && settings?.baseUrl && settings?.model && settings?.apiKey
);