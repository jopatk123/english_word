import { AI_PROVIDERS, DEFAULT_PROVIDER_ID, getProviderById } from '../constants/aiProviders.js';

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
    temperature: 0.2,
  };
};

/**
 * 获取localStorage中的完整配置对象
 * 结构: { currentProviderId, providers, customProviders, customModels }
 */
const getAllAiSettings = () => {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        currentProviderId: DEFAULT_PROVIDER_ID,
        providers: {},
        customProviders: [],
        customModels: {},
      };
    }

    const parsed = JSON.parse(raw);
    return {
      currentProviderId: parsed?.currentProviderId || DEFAULT_PROVIDER_ID,
      providers: parsed?.providers || {},
      customProviders: Array.isArray(parsed?.customProviders) ? parsed.customProviders : [],
      customModels:
        typeof parsed?.customModels === 'object' && parsed?.customModels !== null
          ? parsed.customModels
          : {},
    };
  } catch {
    return {
      currentProviderId: DEFAULT_PROVIDER_ID,
      providers: {},
      customProviders: [],
      customModels: {},
    };
  }
};

/**
 * 保存完整的配置对象到localStorage
 */
const saveAllAiSettings = (allSettings) => {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(allSettings));
};

// ── 自定义厂商 / 模型 公开读取函数（写操作在文件末尾）────────────────────────

/**
 * 返回用户保存的自定义厂商列表
 */
export const getCustomProviders = () => {
  const allSettings = getAllAiSettings();
  return allSettings.customProviders;
};

/**
 * 返回内置厂商 + 自定义厂商的合并列表
 */
export const getAllProviders = () => [...AI_PROVIDERS, ...getCustomProviders()];

/**
 * 返回某厂商的自定义模型列表
 */
export const getCustomModels = (providerId) => {
  const allSettings = getAllAiSettings();
  const list = allSettings.customModels?.[providerId];
  return Array.isArray(list) ? list : [];
};

/**
 * 返回某厂商的所有模型（内置 + 自定义）
 */
export const getAllModels = (providerId) => {
  const provider = getAllProviders().find((p) => p.id === providerId);
  const builtIn = provider?.models || [];
  return [...builtIn, ...getCustomModels(providerId)];
};

// ── 规范化 ────────────────────────────────────────────────────────────────────

/**
 * 规范化单个提供者的配置（兼容内置厂商和自定义厂商）
 */
const normalizeProviderSettings = (settings) => {
  const provider =
    getAllProviders().find((p) => p.id === settings.providerId) || getAllProviders()[0];
  const allModels = getAllModels(provider.id);
  const rawTemp = parseFloat(settings.temperature);
  const temperature =
    !isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? Math.round(rawTemp * 10) / 10 : 0.2;
  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: settings.baseUrl?.trim() || provider.baseUrl,
    model: allModels.includes(settings.model) ? settings.model : allModels[0] || '',
    apiKey: settings.apiKey?.trim() || '',
    temperature,
  };
};

/**
 * 加载当前选中提供者的配置
 */
export const loadAiSettings = () => {
  const allSettings = getAllAiSettings();
  const currentProviderId = allSettings.currentProviderId;
  const provider =
    getAllProviders().find((p) => p.id === currentProviderId) || getAllProviders()[0];
  const allModels = getAllModels(provider.id);

  const saved = allSettings.providers[provider.id];
  if (saved) {
    const rawTemp = parseFloat(saved.temperature);
    const temperature =
      !isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? Math.round(rawTemp * 10) / 10 : 0.2;
    return {
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: saved.baseUrl || provider.baseUrl,
      model: allModels.includes(saved.model) ? saved.model : allModels[0] || '',
      apiKey: saved.apiKey || '',
      temperature,
    };
  }

  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: allModels[0] || '',
    apiKey: '',
    temperature: 0.2,
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
    temperature: normalized.temperature,
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
  const provider = getAllProviders().find((p) => p.id === providerId) || getAllProviders()[0];
  const allModels = getAllModels(provider.id);
  const allSettings = getAllAiSettings();

  const saved = allSettings.providers[provider.id];
  if (saved && saved.apiKey) {
    const rawTemp = parseFloat(saved.temperature);
    const temperature =
      !isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? Math.round(rawTemp * 10) / 10 : 0.2;
    return {
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: saved.baseUrl || provider.baseUrl,
      model: allModels.includes(saved.model) ? saved.model : allModels[0] || '',
      apiKey: saved.apiKey,
      temperature,
    };
  }

  return {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: allModels[0] || '',
    apiKey: '',
    temperature: 0.2,
  };
};

export const maskApiKey = (apiKey) => {
  if (!apiKey) return '未配置';
  if (apiKey.length <= 8) return '已配置';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

export const isAiSettingsReady = (settings) =>
  Boolean(
    settings?.providerId &&
    settings?.providerType &&
    settings?.baseUrl &&
    settings?.model &&
    settings?.apiKey
  );

// ── 自定义厂商 写操作 ──────────────────────────────────────────────────────────

/**
 * 保存一个新的自定义厂商，返回新厂商对象
 */
export const saveCustomProvider = (name, baseUrl) => {
  const allSettings = getAllAiSettings();
  const id = `custom_${Date.now()}`;
  const newProvider = {
    id,
    name: name.trim(),
    baseUrl: baseUrl?.trim() || '',
    providerType: 'openai-compatible',
    models: [],
  };
  allSettings.customProviders.push(newProvider);
  saveAllAiSettings(allSettings);
  return newProvider;
};

/**
 * 删除一个自定义厂商（同时清除其已保存的配置和自定义模型）
 */
export const deleteCustomProvider = (providerId) => {
  const allSettings = getAllAiSettings();
  allSettings.customProviders = allSettings.customProviders.filter((p) => p.id !== providerId);
  delete allSettings.providers[providerId];
  delete allSettings.customModels[providerId];
  if (allSettings.currentProviderId === providerId) {
    allSettings.currentProviderId = DEFAULT_PROVIDER_ID;
  }
  saveAllAiSettings(allSettings);
};

// ── 自定义模型 写操作 ──────────────────────────────────────────────────────────

/**
 * 为某厂商添加一个自定义模型
 */
export const addCustomModel = (providerId, modelName) => {
  const trimmed = modelName?.trim();
  if (!trimmed) return;
  const allSettings = getAllAiSettings();
  if (!allSettings.customModels[providerId]) {
    allSettings.customModels[providerId] = [];
  }
  if (!allSettings.customModels[providerId].includes(trimmed)) {
    allSettings.customModels[providerId].push(trimmed);
  }
  saveAllAiSettings(allSettings);
};

/**
 * 删除某厂商下的一个自定义模型
 */
export const deleteCustomModel = (providerId, modelName) => {
  const allSettings = getAllAiSettings();
  if (!allSettings.customModels[providerId]) return;
  allSettings.customModels[providerId] = allSettings.customModels[providerId].filter(
    (m) => m !== modelName
  );
  saveAllAiSettings(allSettings);
};
