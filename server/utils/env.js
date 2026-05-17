import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const readEnv = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

const missingEnvMessage = (name) => `缺少环境变量 ${name}，请参考项目根目录 .env.example 完成配置`;
const TEST_ADMIN_PASSWORD_HASH = '$2b$10$AVCABJrjHP7GZaizpnFmIOCQZdR6ak1.eVTXh835EERT9RMjOoM56';

export const getJwtSecret = () => {
  const secret = readEnv('JWT_SECRET');
  if (secret) return secret;

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret';
  }

  throw new Error(missingEnvMessage('JWT_SECRET'));
};

export const getAdminJwtSecret = () => {
  const secret = readEnv('ADMIN_JWT_SECRET');
  if (secret) return secret;

  if (process.env.NODE_ENV === 'test') {
    return 'test-admin-jwt-secret';
  }

  throw new Error(missingEnvMessage('ADMIN_JWT_SECRET'));
};

export const getAdminPasswordHash = () => {
  const passwordHash = readEnv('ADMIN_PASSWORD_HASH');
  if (passwordHash) {
    if (/^\$2[aby]\$(1[0-9]|2[0-9]|3[01])\$/.test(passwordHash)) {
      return passwordHash;
    }
    throw new Error('环境变量 ADMIN_PASSWORD_HASH 必须是 cost 不低于 10 的 bcrypt 哈希值');
  }

  if (process.env.NODE_ENV === 'test') {
    return TEST_ADMIN_PASSWORD_HASH;
  }

  throw new Error(missingEnvMessage('ADMIN_PASSWORD_HASH'));
};

export const getAiSettingsSecret = () => {
  const secret = readEnv('AI_SETTINGS_SECRET');
  if (secret) return secret;

  if (process.env.NODE_ENV === 'test') {
    return 'test-ai-settings-secret';
  }

  throw new Error(missingEnvMessage('AI_SETTINGS_SECRET'));
};

export const getDbPath = () => {
  const dbPath = readEnv('DB_PATH');
  if (dbPath) return dbPath;

  throw new Error(missingEnvMessage('DB_PATH'));
};

export const getServerPort = () => {
  const rawPort = readEnv('PORT');
  if (!rawPort) {
    throw new Error(missingEnvMessage('PORT'));
  }

  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('环境变量 PORT 必须是 1-65535 之间的整数');
  }

  return port;
};

/**
 * 返回允许跨域的来源列表（逗号分隔），未配置时返回空数组（仅允许同源）。
 * 本地开发可设置：ALLOWED_ORIGINS=http://localhost:5173
 */
export const getAllowedOrigins = () => {
  const raw = readEnv('ALLOWED_ORIGINS');
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};
