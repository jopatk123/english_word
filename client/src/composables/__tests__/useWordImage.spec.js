import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWordImage } from '../useWordImage.js';

const { getWordImageBlobMock } = vi.hoisted(() => ({
  getWordImageBlobMock: vi.fn(),
}));

vi.mock('../../api/index.js', () => ({
  getWordImageBlob: (...args) => getWordImageBlobMock(...args),
}));

// jsdom 未实现 URL.createObjectURL / revokeObjectURL，手动 stub 以便断言
let urlSeq = 0;
const createObjectURLMock = vi.fn(() => `blob:mock-${(urlSeq += 1)}`);
const revokeObjectURLMock = vi.fn();

const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const mountHost = (wordId, hasImage) => {
  const state = reactive({ wordId, hasImage });
  let exposed;
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useWordImage(
          () => state.wordId,
          () => state.hasImage
        );
        return () => h('div');
      },
    })
  );
  return { wrapper, state, exposed };
};

describe('useWordImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    urlSeq = 0;
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;
  });

  it('hasImage 为 true 时加载图片并生成 objectURL', async () => {
    getWordImageBlobMock.mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const { exposed } = mountHost(12, true);
    await flushPromises();

    expect(getWordImageBlobMock).toHaveBeenCalledWith(12);
    expect(exposed.objectUrl.value).toBe('blob:mock-1');
    expect(exposed.loading.value).toBe(false);
    expect(exposed.loadError.value).toBe('');
  });

  it('hasImage 为 false 时不发起请求', async () => {
    const { exposed } = mountHost(12, false);
    await flushPromises();

    expect(getWordImageBlobMock).not.toHaveBeenCalled();
    expect(exposed.objectUrl.value).toBe('');
  });

  it('旧请求后返回时不会覆盖新卡片的图片', async () => {
    const first = defer();
    const second = defer();
    getWordImageBlobMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { state, exposed } = mountHost(1, true);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);

    state.wordId = 2; // 快速切换卡片，触发第二次加载
    await flushPromises();

    second.resolve(new Blob(['new'], { type: 'image/jpeg' }));
    await flushPromises();
    expect(exposed.objectUrl.value).toBe('blob:mock-1');

    // 旧请求（单词 1）在请求 2 之后才返回：必须被丢弃，不得覆盖/新建 objectURL
    first.resolve(new Blob(['old'], { type: 'image/jpeg' }));
    await flushPromises();
    expect(exposed.objectUrl.value).toBe('blob:mock-1');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it('卸载后返回的在途请求不会创建 objectURL', async () => {
    const pending = defer();
    getWordImageBlobMock.mockImplementationOnce(() => pending.promise);

    const { wrapper, exposed } = mountHost(1, true);
    expect(getWordImageBlobMock).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    pending.resolve(new Blob(['img'], { type: 'image/jpeg' }));
    await flushPromises();

    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(exposed.objectUrl.value).toBe('');
  });
});
