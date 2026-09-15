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
const TEST_ADMIN_PASSWORD_HASH = '$2b$10$zdBrxCT4mCv97LpDICclUuaYxm/us2VoE3mXH7VZgnHM28MPLuZSm';

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
  if (secret) {
    if (secret === getJwtSecret()) {
      throw new Error('ADMIN_JWT_SECRET 必须与 JWT_SECRET 使用不同的随机字符串');
    }
    return secret;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-admin-jwt-secret';
  }

  throw new Error(missingEnvMessage('ADMIN_JWT_SECRET'));
};

export const getAdminPasswordHash = () => {
  // 同一个 .env 既被 docker-compose 读取（要求 bcrypt 哈希里的 $ 转义为 $$，
  // 否则会被当成变量插值），也被本地 dotenv 读取（不做任何转义）。
  // 这里统一还原 $$ -> $，保证两种运行方式都能正常工作。
  const passwordHash = readEnv('ADMIN_PASSWORD_HASH').replace(/\$\$/g, '$');
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

export const getApiTokenPepper = () => {
  const pepper = readEnv('API_TOKEN_PEPPER');
  if (pepper) {
    if (pepper === getJwtSecret()) {
      throw new Error('API_TOKEN_PEPPER 必须与 JWT_SECRET 使用不同的随机字符串');
    }
    return pepper;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-api-token-pepper';
  }

  throw new Error(missingEnvMessage('API_TOKEN_PEPPER'));
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

/**
 * 返回 Express 的 trust proxy 配置。
 *
 * 未设置 TRUST_PROXY 时：生产环境默认信任一层反向代理（1），
 * 其他环境默认为 false，避免客户端伪造 X-Forwarded-For 绕过 IP 限流。
 * 若服务直接暴露公网（无反向代理），必须显式设置 TRUST_PROXY=false。
 *
 * 支持取值：false / true / 正整数（信任的代理跳数）/ Express 支持的其他写法（如 loopback、IP 网段）。
 */
export const getTrustProxySetting = () => {
  const raw = readEnv('TRUST_PROXY');
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? 1 : false;
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true') return true;
  if (/^\d+$/.test(normalized)) {
    const hops = Number.parseInt(normalized, 10);
    if (hops >= 1) return hops;
  }

  return raw;
};
