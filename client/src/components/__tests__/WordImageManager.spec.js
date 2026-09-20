import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WordImageManager from '../WordImageManager.vue';

const {
  uploadWordImageMock,
  deleteWordImageMock,
  getWordImageBlobMock,
  compressWordImageFileMock,
  invalidateWordImageCacheMock,
  elMessage,
  elMessageBox,
} = vi.hoisted(() => ({
  uploadWordImageMock: vi.fn(),
  deleteWordImageMock: vi.fn(),
  getWordImageBlobMock: vi.fn(),
  compressWordImageFileMock: vi.fn(),
  invalidateWordImageCacheMock: vi.fn(),
  elMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  elMessageBox: { confirm: vi.fn() },
}));

vi.mock('../../api/index.js', () => ({
  uploadWordImage: (...args) => uploadWordImageMock(...args),
  deleteWordImage: (...args) => deleteWordImageMock(...args),
  getWordImageBlob: (...args) => getWordImageBlobMock(...args),
}));

vi.mock('../../utils/wordImageCache.js', () => ({
  invalidateWordImageCache: (...args) => invalidateWordImageCacheMock(...args),
}));

vi.mock('../../utils/wordImageCompress.js', () => ({
  compressWordImageFile: (...args) => compressWordImageFileMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: elMessageBox,
}));

const globalStubs = {
  WordImage: { template: '<div class="word-image-stub" />' },
  'el-button': {
    props: ['disabled', 'loading', 'type'],
    emits: ['click'],
    template:
      '<button class="el-btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
};

describe('WordImageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    elMessageBox.confirm.mockResolvedValue(true);
    compressWordImageFileMock.mockImplementation(async (file) => file);
    uploadWordImageMock.mockResolvedValue({ msg: '记忆图片已保存', data: { hasImage: true } });
    getWordImageBlobMock.mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    deleteWordImageMock.mockResolvedValue({ data: { hasImage: false } });
  });

  afterEach(() => {
    document.querySelectorAll('a[download]').forEach((node) => node.remove());
  });

  const mountManager = (props = {}) =>
    mount(WordImageManager, {
      props: { wordId: 12, wordName: 'apple', hasImage: false, ...props },
      global: { stubs: globalStubs },
    });

  it('展示推荐分辨率和压缩说明', () => {
    const wrapper = mountManager();
    expect(wrapper.text()).toContain('1280×800');
    expect(wrapper.text()).toContain('1280×720');
    expect(wrapper.text()).toContain('300KB');
    expect(wrapper.text()).toContain('640');
    expect(wrapper.text()).toContain('上传图片');
  });

  it('已有图片时显示替换和下载', () => {
    const wrapper = mountManager({ hasImage: true });
    expect(wrapper.text()).toContain('替换图片');
    expect(wrapper.text()).toContain('下载图片');
    expect(wrapper.find('.word-image-stub').exists()).toBe(true);
  });

  it('已有图片时再次选择文件会走替换上传', async () => {
    const wrapper = mountManager({ hasImage: true });
    const file = new File([new Uint8Array([4, 5, 6])], 'next.jpg', { type: 'image/jpeg' });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await Promise.resolve();
    await Promise.resolve();

    expect(compressWordImageFileMock).toHaveBeenCalledWith(file);
    expect(uploadWordImageMock).toHaveBeenCalledWith(12, file);
    expect(invalidateWordImageCacheMock).toHaveBeenCalledWith(12);
    expect(wrapper.emitted('update:hasImage')?.[0]).toEqual([true]);
  });

  it('选择文件后会压缩并上传，然后通知父组件', async () => {
    const wrapper = mountManager();
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await Promise.resolve();
    await Promise.resolve();

    expect(compressWordImageFileMock).toHaveBeenCalledWith(file);
    expect(uploadWordImageMock).toHaveBeenCalledWith(12, file);
    expect(wrapper.emitted('update:hasImage')?.[0]).toEqual([true]);
    expect(elMessage.success).toHaveBeenCalled();
  });

  it('确认后可以删除图片', async () => {
    const wrapper = mountManager({ hasImage: true });
    const deleteBtn = wrapper.findAll('.el-btn').find((btn) => btn.text().includes('删除图片'));
    await deleteBtn.trigger('click');
    await Promise.resolve();
    await Promise.resolve();

    expect(elMessageBox.confirm).toHaveBeenCalled();
    expect(deleteWordImageMock).toHaveBeenCalledWith(12);
    expect(invalidateWordImageCacheMock).toHaveBeenCalledWith(12);
    expect(wrapper.emitted('update:hasImage')?.[0]).toEqual([false]);
  });
});
