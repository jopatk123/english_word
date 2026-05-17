import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, UserAiSetting } from '../models/index.js';
import aiSettingsRouter from '../routes/ai-settings.js';
import { resolveUserAiConfig } from '../services/user-ai-settings.js';
import { decryptAiSettingsPayload, encryptAiSettingsPayload } from '../utils/aiSettingsCrypto.js';

const suffix = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

const buildLegacyEncryptedRecord = (payload, secret) => {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(`ai-settings:${secret}`).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload || {});
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: encrypted.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
};

const buildApp = (userId) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/ai-settings', aiSettingsRouter);
  return app;
};

let app;
let otherApp;
let user;

beforeAll(async () => {
  await initDB();
  user = await User.create({ username: `ai_settings_${suffix()}`, password: 'password123' });
  const otherUser = await User.create({
    username: `ai_settings_other_${suffix()}`,
    password: 'password123',
  });
  app = buildApp(user.id);
  otherApp = buildApp(otherUser.id);
});

describe('AI settings route', () => {
  it('初始返回空摘要', async () => {
    const res = await request(app).get('/ai-settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      providerKeys: {},
      savedProviderIds: [],
    });
  });

  it('保存后以掩码形式返回，且数据库不保存明文 key', async () => {
    const saveRes = await request(app).put('/ai-settings').send({
      providerId: 'openai',
      apiKey: 'sk-test-key-12345',
    });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data).toEqual({
      providerId: 'openai',
      maskedApiKey: 'sk-t****2345',
    });

    const summaryRes = await request(app).get('/ai-settings');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toEqual({
      providerKeys: { openai: 'sk-t****2345' },
      savedProviderIds: ['openai'],
    });

    const record = await UserAiSetting.findOne({ where: { userId: user.id } });
    expect(record).toBeTruthy();
    expect(record.encryptedPayload).not.toContain('sk-test-key-12345');
  });

  it('不同用户之间的密钥摘要相互隔离', async () => {
    await request(otherApp).put('/ai-settings').send({
      providerId: 'deepseek',
      apiKey: 'sk-other-user-9999',
    });

    const ownSummary = await request(app).get('/ai-settings');
    const otherSummary = await request(otherApp).get('/ai-settings');

    expect(ownSummary.body.data.providerKeys).toEqual({ openai: 'sk-t****2345' });
    expect(otherSummary.body.data.providerKeys).toEqual({ deepseek: 'sk-o****9999' });
  });

  it('删除指定厂商后摘要同步更新', async () => {
    const deleteRes = await request(app).delete('/ai-settings/providers/openai');
    expect(deleteRes.status).toBe(200);

    const summaryRes = await request(app).get('/ai-settings');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data.providerKeys).toEqual({});
  });
});

describe('resolveUserAiConfig', () => {
  it('在请求未携带 apiKey 时使用服务端已保存 key', async () => {
    await request(app).put('/ai-settings').send({
      providerId: 'openai',
      apiKey: 'sk-restored-12345',
    });

    const config = await resolveUserAiConfig(user.id, {
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.3,
    });

    expect(config).toMatchObject({
      providerId: 'openai',
      apiKey: 'sk-restored-12345',
      providerMode: 'openai-compatible',
      temperature: 0.3,
    });
  });
});

describe('AI settings crypto', () => {
  it('可以解密旧 JWT 派生密钥加密的数据', () => {
    const originalAiSecret = process.env.AI_SETTINGS_SECRET;
    const originalJwtSecret = process.env.JWT_SECRET;

    process.env.AI_SETTINGS_SECRET = 'new-ai-secret';
    process.env.JWT_SECRET = 'legacy-jwt-secret';

    try {
      const legacyRecord = buildLegacyEncryptedRecord(
        { openai: 'sk-legacy-12345' },
        'legacy-jwt-secret'
      );

      expect(decryptAiSettingsPayload(legacyRecord)).toEqual({ openai: 'sk-legacy-12345' });
    } finally {
      if (originalAiSecret === undefined) {
        delete process.env.AI_SETTINGS_SECRET;
      } else {
        process.env.AI_SETTINGS_SECRET = originalAiSecret;
      }

      if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalJwtSecret;
      }
    }
  });

  it('使用独立 AI_SETTINGS_SECRET 加密后可正常往返', () => {
    const originalAiSecret = process.env.AI_SETTINGS_SECRET;
    process.env.AI_SETTINGS_SECRET = 'roundtrip-ai-secret';

    try {
      const encrypted = encryptAiSettingsPayload({ deepseek: 'sk-roundtrip-12345' });
      expect(decryptAiSettingsPayload(encrypted)).toEqual({ deepseek: 'sk-roundtrip-12345' });
    } finally {
      if (originalAiSecret === undefined) {
        delete process.env.AI_SETTINGS_SECRET;
      } else {
        process.env.AI_SETTINGS_SECRET = originalAiSecret;
      }
    }
  });
});
