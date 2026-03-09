import { DEFAULT_PROVIDER_ID, getProviderById } from '../constants/aiProviders.js';

export const AI_SETTINGS_STORAGE_KEY = 'english-word-ai-settings';

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

export const loadAiSettings = () => {
  const fallback = createDefaultAiSettings();

  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const provider = getProviderById(parsed?.providerId || fallback.providerId);

    return {
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: parsed?.baseUrl || provider.baseUrl,
      model: provider.models.includes(parsed?.model) ? parsed.model : provider.models[0],
      apiKey: parsed?.apiKey || '',
    };
  } catch {
    return fallback;
  }
};

export const saveAiSettings = (settings) => {
  const provider = getProviderById(settings.providerId);
  const normalized = {
    providerId: provider.id,
    providerType: provider.providerType,
    baseUrl: settings.baseUrl?.trim() || provider.baseUrl,
    model: provider.models.includes(settings.model) ? settings.model : provider.models[0],
    apiKey: settings.apiKey?.trim() || '',
  };

  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const maskApiKey = (apiKey) => {
  if (!apiKey) return '未配置';
  if (apiKey.length <= 8) return '已配置';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

export const isAiSettingsReady = (settings) => Boolean(
  settings?.providerId && settings?.providerType && settings?.baseUrl && settings?.model && settings?.apiKey
);