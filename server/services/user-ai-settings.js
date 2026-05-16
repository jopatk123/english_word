import { UserAiSetting } from '../models/index.js';
import { decryptAiSettingsPayload, encryptAiSettingsPayload } from '../utils/aiSettingsCrypto.js';
import { validateAiConfig } from '../utils/ai.js';

function normalizeProviderId(providerId) {
  return typeof providerId === 'string' ? providerId.trim() : '';
}

function normalizeApiKey(apiKey) {
  return typeof apiKey === 'string' ? apiKey.trim() : '';
}

function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '已配置';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

async function upsertEncryptedPayload(userId, payload, transaction) {
  const encrypted = encryptAiSettingsPayload(payload);
  const existing = await UserAiSetting.findOne({
    where: { userId },
    ...(transaction ? { transaction } : {}),
  });

  if (existing) {
    await existing.update(encrypted, transaction ? { transaction } : {});
    return existing;
  }

  return UserAiSetting.create(
    {
      userId,
      ...encrypted,
    },
    transaction ? { transaction } : {}
  );
}

export async function getUserAiKeyMap(userId, options = {}) {
  const record = await UserAiSetting.findOne({
    where: { userId },
    ...(options.transaction ? { transaction: options.transaction } : {}),
  });
  if (!record) {
    return {};
  }

  try {
    return decryptAiSettingsPayload(record);
  } catch {
    return {};
  }
}

export async function getUserAiKeySummary(userId) {
  const keyMap = await getUserAiKeyMap(userId);
  const providerKeys = Object.fromEntries(
    Object.entries(keyMap)
      .map(([providerId, apiKey]) => [providerId, maskApiKey(normalizeApiKey(apiKey))])
      .filter(([, masked]) => Boolean(masked))
  );

  return {
    providerKeys,
    savedProviderIds: Object.keys(providerKeys),
  };
}

export async function saveUserAiKey(userId, providerId, apiKey, options = {}) {
  const normalizedProviderId = normalizeProviderId(providerId);
  const normalizedApiKey = normalizeApiKey(apiKey);
  if (!normalizedProviderId) {
    throw new Error('缺少 AI providerId');
  }
  if (!normalizedApiKey) {
    throw new Error('API Key 不能为空');
  }

  const current = await getUserAiKeyMap(userId, options);
  current[normalizedProviderId] = normalizedApiKey;
  await upsertEncryptedPayload(userId, current, options.transaction);
  return {
    providerId: normalizedProviderId,
    maskedApiKey: maskApiKey(normalizedApiKey),
  };
}

export async function deleteUserAiKey(userId, providerId, options = {}) {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) return false;

  const current = await getUserAiKeyMap(userId, options);
  if (!current[normalizedProviderId]) {
    return false;
  }

  delete current[normalizedProviderId];
  const existing = await UserAiSetting.findOne({
    where: { userId },
    ...(options.transaction ? { transaction: options.transaction } : {}),
  });
  if (!existing) return false;

  if (Object.keys(current).length === 0) {
    await existing.destroy(options.transaction ? { transaction: options.transaction } : {});
    return true;
  }

  const encrypted = encryptAiSettingsPayload(current);
  await existing.update(encrypted, options.transaction ? { transaction: options.transaction } : {});
  return true;
}

export async function resolveUserAiConfig(userId, config = {}) {
  const normalizedApiKey = normalizeApiKey(config.apiKey);
  if (normalizedApiKey) {
    return validateAiConfig(config);
  }

  const providerId = normalizeProviderId(config.providerId);
  const keyMap = await getUserAiKeyMap(userId);
  return validateAiConfig({
    ...config,
    providerId,
    apiKey: keyMap[providerId] || '',
  });
}
