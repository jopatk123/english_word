/**
 * 测试：API Token 服务
 *   - 明文格式、哈希、名称规范化
 *   - 创建 / 列表 / 撤销
 *   - 过期与禁用用户校验
 */
import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { initDB, User, ApiToken } from '../models/index.js';
import {
  API_TOKEN_PREFIX,
  MAX_TOKEN_NAME_LENGTH,
  MAX_TOKENS_PER_USER,
  ApiTokenError,
  generateToken,
  isWellFormedToken,
  extractTokenPrefix,
  hashToken,
  verifyTokenHash,
  normalizeName,
  createToken,
  listUserTokens,
  revokeToken,
  validateToken,
} from '../services/api-tokens.js';
import { getApiTokenPepper } from '../utils/env.js';

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);

beforeAll(async () => {
  await initDB();
});

describe('API Token 格式与哈希', () => {
  it('生成 ewt_ + 64 hex 明文，且前缀为前 16 位', () => {
    const token = generateToken();
    expect(token).toMatch(/^ewt_[0-9a-f]{64}$/);
    expect(isWellFormedToken(token)).toBe(true);
    expect(extractTokenPrefix(token)).toBe(token.slice(0, 16));
    expect(extractTokenPrefix(token).startsWith(API_TOKEN_PREFIX)).toBe(true);
  });

  it('拒绝格式不正确的 Token', () => {
    expect(isWellFormedToken('')).toBe(false);
    expect(isWellFormedToken(`ewt_${'a'.repeat(63)}`)).toBe(false);
    expect(isWellFormedToken(`ewt_${'A'.repeat(64)}`)).toBe(false);
    expect(isWellFormedToken(`mmt_${'a'.repeat(64)}`)).toBe(false);
    expect(extractTokenPrefix('ewt_short')).toBeNull();
  });

  it('同一 pepper 下哈希可复现，并用时间安全比较校验', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
    expect(verifyTokenHash(hash, token)).toBe(true);
    expect(verifyTokenHash(hash, generateToken())).toBe(false);
  });

  it('normalizeName 会裁剪空值并限制长度', () => {
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('  agent  ')).toBe('agent');
    expect(() => normalizeName('x'.repeat(MAX_TOKEN_NAME_LENGTH + 1))).toThrow(ApiTokenError);
    expect(() => normalizeName(1)).toThrow(/字符串/);
  });
});

describe('getApiTokenPepper', () => {
  const restoreEnv = (name, value) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };

  it('已配置时返回独立 pepper', () => {
    const original = process.env.API_TOKEN_PEPPER;
    process.env.API_TOKEN_PEPPER = 'custom-api-token-pepper';
    try {
      expect(getApiTokenPepper()).toBe('custom-api-token-pepper');
    } finally {
      restoreEnv('API_TOKEN_PEPPER', original);
    }
  });

  it('与 JWT_SECRET 相同时抛错', () => {
    const originalPepper = process.env.API_TOKEN_PEPPER;
    const originalJwt = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'same-secret';
    process.env.API_TOKEN_PEPPER = 'same-secret';
    try {
      expect(() => getApiTokenPepper()).toThrow(/JWT_SECRET/);
    } finally {
      restoreEnv('API_TOKEN_PEPPER', originalPepper);
      restoreEnv('JWT_SECRET', originalJwt);
    }
  });
});

describe('API Token 生命周期', () => {
  let user;

  beforeAll(async () => {
    user = await User.create({
      username: `token_svc_${suf()}`,
      password: await bcrypt.hash('pass1234', 4),
    });
  });

  it('创建后列表只返回前缀与元数据，明文仅创建时出现', async () => {
    const created = await createToken(user.id, { name: '脚本' });
    expect(created.token).toMatch(/^ewt_[0-9a-f]{64}$/);
    expect(created.tokenPrefix).toBe(created.token.slice(0, 16));
    expect(created.name).toBe('脚本');

    const listed = await listUserTokens(user.id);
    const row = listed.find((item) => item.id === created.id);
    expect(row).toMatchObject({
      id: created.id,
      name: '脚本',
      tokenPrefix: created.tokenPrefix,
    });
    expect(row.createdAt).toBeTruthy();
    expect(row).not.toHaveProperty('token');
    expect(row).not.toHaveProperty('tokenHash');
  });

  it('validateToken 接受有效 Token，并节流写入 lastUsedAt', async () => {
    const created = await createToken(user.id, { name: '校验' });
    const authenticated = await validateToken(created.token);
    expect(authenticated.id).toBe(user.id);

    const stored = await ApiToken.findByPk(created.id);
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });

  it('撤销后 Token 立即失效，对不存在 ID 幂等成功', async () => {
    const created = await createToken(user.id, { name: '待撤销' });
    expect(await revokeToken(created.id, user.id)).toBe(true);
    expect(await validateToken(created.token)).toBeNull();
    expect(await revokeToken(created.id, user.id)).toBe(false);
  });

  it('过期 Token 不能通过校验', async () => {
    const created = await createToken(user.id, {
      name: '过期',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await ApiToken.update(
      { expiresAt: new Date(Date.now() - 1000) },
      { where: { id: created.id } }
    );
    expect(await validateToken(created.token)).toBeNull();
  });

  it('禁用用户的 Token 仍能解析到用户，由鉴权中间件拒绝', async () => {
    const disabledUser = await User.create({
      username: `token_disabled_${suf()}`,
      password: await bcrypt.hash('pass1234', 4),
      isDisabled: true,
    });
    const created = await createToken(disabledUser.id, { name: '禁用账号' });
    const authenticated = await validateToken(created.token);
    expect(authenticated.id).toBe(disabledUser.id);
    expect(authenticated.isDisabled).toBe(true);
  });

  it('达到数量上限后拒绝继续创建', async () => {
    const limitedUser = await User.create({
      username: `token_limit_${suf()}`,
      password: await bcrypt.hash('pass1234', 4),
    });
    for (let i = 0; i < MAX_TOKENS_PER_USER; i += 1) {
      await createToken(limitedUser.id, { name: `t${i}` });
    }
    await expect(createToken(limitedUser.id, { name: 'overflow' })).rejects.toThrow(/上限/);
  });
});
