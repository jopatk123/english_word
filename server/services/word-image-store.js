import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { getUserImageDir, getWordImagePath, WORD_IMAGE } from '../utils/wordImage.js';

export async function saveWordImageFile(userId, wordId, buffer) {
  const filePath = getWordImagePath(userId, wordId);
  const tmpPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, buffer);
  await fs.rename(tmpPath, filePath);
  return filePath;
}

export async function removeWordImageFile(userId, wordId) {
  const filePath = getWordImagePath(userId, wordId);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      logger.warn('word-image-unlink-failed', { userId, wordId, message: err.message });
    }
  }

  const userDir = getUserImageDir(userId);
  try {
    await fs.rmdir(userDir);
  } catch {
    // 目录非空或不存在时忽略
  }
}

export async function removeUserWordImages(userId) {
  const userDir = getUserImageDir(userId);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
  } catch (err) {
    logger.warn('word-image-user-dir-cleanup-failed', { userId, message: err.message });
  }
}

export async function wordImageFileExists(userId, wordId) {
  try {
    await fs.access(getWordImagePath(userId, wordId));
    return true;
  } catch {
    return false;
  }
}

export { WORD_IMAGE, getWordImagePath };
