import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initDB, User, UserAiSetting } from '../models/index.js';
import aiSettingsRouter from '../routes/ai-settings.js';
import { resolveUserAiConfig } from '../services/user-ai-settings.js';

const suffix = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

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
