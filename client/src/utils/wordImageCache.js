import { getWordImageBlob } from '../api/index.js';

/** 同时只保留当前卡 + 下一张图，避免复习队列把 blob 堆在内存里。 */
const MAX_CACHED_BLOBS = 2;

/** 缓存条目过期时间：长会话期间他处（如其他标签页）替换图片后，过期即可重新拉取。 */
export const WORD_IMAGE_CACHE_TTL_MS = 5 * 60 * 1000;

const blobs = new Map();
const inflight = new Map();
const generations = new Map();

function bumpGeneration(wordId) {
  generations.set(wordId, (generations.get(wordId) || 0) + 1);
}

function toWordId(wordId) {
  const id = Number(wordId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function rememberBlob(wordId, blob) {
  if (blobs.has(wordId)) blobs.delete(wordId);
  blobs.set(wordId, { blob, cachedAt: Date.now() });
  while (blobs.size > MAX_CACHED_BLOBS) {
    const oldest = blobs.keys().next().value;
    blobs.delete(oldest);
  }
}

/** 返回未过期的缓存条目；过期条目就地移除并返回 null。 */
function getFreshEntry(wordId) {
  const entry = blobs.get(wordId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > WORD_IMAGE_CACHE_TTL_MS) {
    blobs.delete(wordId);
    return null;
  }
  return entry;
}

function isJsonBlob(blob) {
  return Boolean(blob?.type && blob.type.includes('application/json'));
}

function cardWordId(record) {
  return toWordId(record?.word?.id || record?.wordId);
}

function cardHasImage(record) {
  return Boolean(record?.word?.hasImage) && cardWordId(record);
}

export function findNextWordImageId(queue, currentIndex) {
  const list = Array.isArray(queue) ? queue : [];
  const start = Number(currentIndex);
  if (!Number.isInteger(start) || start < 0) return null;
  for (let i = start + 1; i < list.length; i += 1) {
    const id = cardHasImage(list[i]);
    if (id) return id;
  }
  return null;
}

export function invalidateWordImageCache(wordId) {
  const id = toWordId(wordId);
  if (!id) return;
  blobs.delete(id);
  inflight.delete(id);
  bumpGeneration(id);
}

export function clearWordImageCache() {
  blobs.clear();
  inflight.clear();
  generations.clear();
}

export async function getCachedWordImageBlob(wordId) {
  const id = toWordId(wordId);
  if (!id) {
    throw new Error('加载记忆图片失败');
  }
  const entry = getFreshEntry(id);
  if (entry) {
    // 命中缓存时重新插入以续期 LRU 顺序（TTL 以取图时间戳为准，不因命中刷新）
    blobs.delete(id);
    blobs.set(id, entry);
    return entry.blob;
  }
  if (inflight.has(id)) {
    return inflight.get(id);
  }

  const generation = generations.get(id) || 0;
  const request = getWordImageBlob(id)
    .then((blob) => {
      if (isJsonBlob(blob)) {
        throw new Error('加载记忆图片失败');
      }
      if ((generations.get(id) || 0) === generation) {
        rememberBlob(id, blob);
      }
      return blob;
    })
    .finally(() => {
      if (inflight.get(id) === request) {
        inflight.delete(id);
      }
    });

  inflight.set(id, request);
  return request;
}

export function preloadWordImage(wordId) {
  const id = toWordId(wordId);
  if (!id) return;
  void getCachedWordImageBlob(id).catch(() => {});
}

export function preloadNextStudyWordImage(queue, currentIndex) {
  const nextId = findNextWordImageId(queue, currentIndex);
  if (!nextId) return null;
  preloadWordImage(nextId);
  return nextId;
}
