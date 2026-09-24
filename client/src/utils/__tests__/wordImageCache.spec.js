import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WORD_IMAGE_CACHE_TTL_MS,
  clearWordImageCache,
  findNextWordImageId,
  getCachedWordImageBlob,
  invalidateWordImageCache,
  preloadNextStudyWordImage,
} from '../wordImageCache.js';

const { getWordImageBlobMock } = vi.hoisted(() => ({
  getWordImageBlobMock: vi.fn(),
}));

vi.mock('../../api/index.js', () => ({
  getWordImageBlob: (...args) => getWordImageBlobMock(...args),
}));

const jpeg = (label) => new Blob([label], { type: 'image/jpeg' });

describe('wordImageCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWordImageCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('跳过没有记忆图片的卡片，定位队列中下一张有图的单词', () => {
    const queue = [
      { wordId: 1, word: { id: 1, hasImage: true } },
      { wordId: 2, word: { id: 2, hasImage: false } },
      { wordId: 3, word: { id: 3, hasImage: true } },
    ];
    expect(findNextWordImageId(queue, 0)).toBe(3);
    expect(findNextWordImageId(queue, 2)).toBe(null);
  });

  it('相同单词的并发加载只发一次请求', async () => {
    let resolveBlob;
    getWordImageBlobMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBlob = resolve;
        })
    );

    const first = getCachedWordImageBlob(8);
    const second = getCachedWordImageBlob(8);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);

    resolveBlob(jpeg('a'));
    const [blobA, blobB] = await Promise.all([first, second]);
    expect(blobA).toBe(blobB);
  });

  it('命中缓存后不再请求网络', async () => {
    getWordImageBlobMock.mockResolvedValue(jpeg('cached'));
    await getCachedWordImageBlob(9);
    await getCachedWordImageBlob(9);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);
  });

  it('预加载失败会被吞掉，不影响后续学习', async () => {
    getWordImageBlobMock.mockRejectedValue(new Error('network'));
    expect(preloadNextStudyWordImage([{ wordId: 4, word: { id: 4, hasImage: true } }], 0)).toBe(
      null
    );
    expect(
      preloadNextStudyWordImage(
        [
          { wordId: 4, word: { id: 4, hasImage: false } },
          { wordId: 5, word: { id: 5, hasImage: true } },
        ],
        0
      )
    ).toBe(5);
    await Promise.resolve();
    expect(getWordImageBlobMock).toHaveBeenCalledWith(5);
  });

  it('替换图片后使缓存失效', async () => {
    getWordImageBlobMock.mockResolvedValueOnce(jpeg('old')).mockResolvedValueOnce(jpeg('new'));
    const oldBlob = await getCachedWordImageBlob(11);
    invalidateWordImageCache(11);
    const nextBlob = await getCachedWordImageBlob(11);
    expect(oldBlob).not.toBe(nextBlob);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(2);
  });

  it('失效后晚到的旧请求不会写回缓存，也不会清掉新的在途请求', async () => {
    let resolveOld;
    let resolveNew;
    getWordImageBlobMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          })
      );

    const stale = getCachedWordImageBlob(21);
    invalidateWordImageCache(21);
    const fresh = getCachedWordImageBlob(21);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(2);

    resolveNew(jpeg('fresh'));
    const freshBlob = await fresh;
    expect(await getCachedWordImageBlob(21)).toBe(freshBlob);

    resolveOld(jpeg('stale'));
    await stale;
    expect(await getCachedWordImageBlob(21)).toBe(freshBlob);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(2);
  });

  it('接口误返回 JSON 时不写入缓存', async () => {
    getWordImageBlobMock.mockResolvedValue(new Blob(['{"msg":"x"}'], { type: 'application/json' }));
    await expect(getCachedWordImageBlob(7)).rejects.toThrow(/加载记忆图片失败/);
    getWordImageBlobMock.mockResolvedValue(jpeg('ok'));
    await getCachedWordImageBlob(7);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(2);
  });

  it('超过容量上限时按 LRU 驱逐，命中会续期', async () => {
    getWordImageBlobMock.mockImplementation((id) => Promise.resolve(jpeg(`blob-${id}`)));
    await getCachedWordImageBlob(41); // 缓存：[41]
    await getCachedWordImageBlob(42); // 缓存：[41, 42]
    await getCachedWordImageBlob(41); // 命中续期 → [42, 41]
    await getCachedWordImageBlob(43); // 超限驱逐 42 → [41, 43]

    getWordImageBlobMock.mockClear();
    await getCachedWordImageBlob(41); // 续期过，仍在缓存
    expect(getWordImageBlobMock).not.toHaveBeenCalled();
    await getCachedWordImageBlob(42); // 已被驱逐，重新请求
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);
  });

  it('超过 TTL 后缓存过期并重新请求', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    getWordImageBlobMock.mockResolvedValueOnce(jpeg('old'));
    const staleBlob = await getCachedWordImageBlob(51);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(WORD_IMAGE_CACHE_TTL_MS + 1);
    getWordImageBlobMock.mockResolvedValueOnce(jpeg('fresh'));
    const freshBlob = await getCachedWordImageBlob(51);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(2);
    expect(freshBlob).not.toBe(staleBlob);
  });

  it('TTL 之内命中缓存不重复请求', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    getWordImageBlobMock.mockResolvedValue(jpeg('cached'));
    await getCachedWordImageBlob(52);
    vi.setSystemTime(WORD_IMAGE_CACHE_TTL_MS - 1);
    await getCachedWordImageBlob(52);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);
  });
});
