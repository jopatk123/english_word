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

export const getJwtSecret = () => {
  const secret = readEnv('JWT_SECRET');
  if (secret) return secret;

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret';
  }

  throw new Error(missingEnvMessage('JWT_SECRET'));
};

export const getAdminPassword = () => {
  const password = readEnv('ADMIN_PASSWORD');
  if (password) return password;

  if (process.env.NODE_ENV === 'test') {
    return 'test-admin-password';
  }

  throw new Error(
    `${missingEnvMessage('ADMIN_PASSWORD')}。\n` + '为保证安全，系统不再提供内置默认密码。'
  );
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
