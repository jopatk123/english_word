import crypto from 'crypto';
import { getJwtSecret } from './env.js';

const IV_BYTES = 12;

function getEncryptionKey() {
  return crypto.createHash('sha256').update(`ai-settings:${getJwtSecret()}`).digest();
}

export function encryptAiSettingsPayload(payload) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = JSON.stringify(payload || {});
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: encrypted.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
}

export function decryptAiSettingsPayload(record) {
  if (!record?.encryptedPayload || !record?.iv || !record?.authTag) {
    return {};
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(record.iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedPayload, 'base64url')),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString('utf8'));
  return parsed && typeof parsed === 'object' ? parsed : {};
}
