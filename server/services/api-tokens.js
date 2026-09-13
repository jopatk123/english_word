import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize, ApiToken, User } from '../models/index.js';
import { getApiTokenPepper } from '../utils/env.js';
import logger from '../utils/logger.js';

export const API_TOKEN_PREFIX = 'ewt_';
export const API_TOKEN_BODY_HEX_LENGTH = 64;
export const API_TOKEN_PREFIX_DISPLAY_LENGTH = 16;
export const MAX_TOKENS_PER_USER = 20;
export const MAX_TOKEN_NAME_LENGTH = 100;
const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const EXPIRED_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let lastExpiredCleanupAt = 0;

export class ApiTokenError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ApiTokenError';
    this.statusCode = statusCode;
  }
}

export const generateToken = () => `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;

export const isWellFormedToken = (token) =>
  typeof token === 'string' &&
  token.startsWith(API_TOKEN_PREFIX) &&
  token.length === API_TOKEN_PREFIX.length + API_TOKEN_BODY_HEX_LENGTH &&
  /^[0-9a-f]+$/.test(token.slice(API_TOKEN_PREFIX.length));

export const extractTokenPrefix = (token) => {
  if (!isWellFormedToken(token)) return null;
  return token.slice(0, API_TOKEN_PREFIX_DISPLAY_LENGTH);
};

export const hashToken = (token) =>
  crypto.createHmac('sha256', getApiTokenPepper()).update(token, 'utf8').digest('hex');

export const verifyTokenHash = (tokenHash, token) => {
  if (!tokenHash || !token) return false;
  try {
    const expected = Buffer.from(hashToken(token), 'hex');
    const actual = Buffer.from(String(tokenHash), 'hex');
    if (expected.length === 0 || expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch (error) {
    logger.warn('API Token 校验失败', { error: error.message });
    return false;
  }
};

export const normalizeName = (name) => {
  if (name == null || name === '') return null;
  if (typeof name !== 'string') {
    throw new ApiTokenError('Token 名称必须是字符串');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_TOKEN_NAME_LENGTH) {
    throw new ApiTokenError(`Token 名称最多 ${MAX_TOKEN_NAME_LENGTH} 个字符`);
  }
  return trimmed || null;
};

const toPublicToken = (record) => ({
  id: record.id,
  name: record.name,
  tokenPrefix: record.tokenPrefix,
  expiresAt: record.expiresAt,
  lastUsedAt: record.lastUsedAt,
  createdAt: record.createdAt,
});

export const createToken = async (userId, options = {}) => {
  const name = normalizeName(options.name);
  if (!userId) throw new ApiTokenError('缺少用户 ID');

  const token = generateToken();
  const tokenPrefix = extractTokenPrefix(token);
  const tokenHash = hashToken(token);

  const record = await sequelize.transaction(async (transaction) => {
    await ApiToken.destroy({
      where: { userId, expiresAt: { [Op.lt]: new Date() } },
      transaction,
    });

    const activeCount = await ApiToken.count({ where: { userId }, transaction });
    if (activeCount >= MAX_TOKENS_PER_USER) {
      throw new ApiTokenError(
        `已达到 Token 数量上限（${MAX_TOKENS_PER_USER}），请先撤销不用的 Token`,
        400
      );
    }

    return ApiToken.create(
      {
        userId,
        tokenHash,
        tokenPrefix,
        name,
        expiresAt: options.expiresAt || null,
      },
      { transaction }
    );
  });

  logger.info('API Token 已创建', { userId, tokenId: record.id });

  return {
    ...toPublicToken(record),
    token,
  };
};

export const listUserTokens = async (userId) => {
  if (!userId) throw new ApiTokenError('缺少用户 ID');

  await ApiToken.destroy({
    where: { userId, expiresAt: { [Op.lt]: new Date() } },
  });

  const rows = await ApiToken.findAll({
    where: { userId },
    order: [['create_time', 'DESC']],
  });

  return rows.map(toPublicToken);
};

export const revokeToken = async (tokenId, userId) => {
  const id = Number(tokenId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiTokenError('Token ID 无效');
  }
  if (!userId) throw new ApiTokenError('缺少用户 ID');

  const deleted = await ApiToken.destroy({ where: { id, userId } });
  if (deleted > 0) {
    logger.info('API Token 已撤销', { userId, tokenId: id });
  }
  return deleted > 0;
};

export const maybeCleanupExpiredTokens = async () => {
  if (Date.now() - lastExpiredCleanupAt < EXPIRED_CLEANUP_INTERVAL_MS) return;
  lastExpiredCleanupAt = Date.now();
  try {
    await ApiToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  } catch (error) {
    logger.warn('清理过期 API Token 失败', { error: error.message });
  }
};

const touchLastUsedAt = async (record, now) => {
  const lastUsedAt = record.lastUsedAt ? new Date(record.lastUsedAt).getTime() : 0;
  if (lastUsedAt && now.getTime() - lastUsedAt < LAST_USED_UPDATE_INTERVAL_MS) return;
  try {
    await record.update({ lastUsedAt: now });
  } catch (error) {
    logger.warn('更新 API Token lastUsedAt 失败', { error: error.message });
  }
};

export const validateToken = async (token) => {
  if (!isWellFormedToken(token)) return null;

  await maybeCleanupExpiredTokens();

  const record = await ApiToken.findOne({
    where: { tokenHash: hashToken(token) },
    include: [{ model: User, as: 'user' }],
  });

  if (!record?.user) return null;

  const now = new Date();
  if (record.expiresAt && new Date(record.expiresAt) < now) return null;
  if (!verifyTokenHash(record.tokenHash, token)) return null;

  if (!record.user.isDisabled) {
    await touchLastUsedAt(record, now);
  }
  return record.user;
};
