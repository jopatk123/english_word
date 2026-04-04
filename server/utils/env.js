import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const readEnv = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const getJwtSecret = () => {
  const secret = readEnv('JWT_SECRET');
  if (secret) return secret;

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret';
  }

  throw new Error('缺少环境变量 JWT_SECRET，请参考项目根目录 .env.example 完成配置');
};