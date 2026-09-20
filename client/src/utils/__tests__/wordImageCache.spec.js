import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
    getWordImageBlobMock
      .mockResolvedValueOnce(jpeg('old'))
      .mockResolvedValueOnce(jpeg('new'));
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
});
