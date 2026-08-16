import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiModelFetch } from '../useAiModelFetch.js';

const { fetchAiModelsMock, saveFetchedModelsMock, batchAddCustomModelsMock, getCustomModelsMock } =
  vi.hoisted(() => ({
    fetchAiModelsMock: vi.fn(),
    saveFetchedModelsMock: vi.fn(),
    batchAddCustomModelsMock: vi.fn(() => 0),
    getCustomModelsMock: vi.fn(() => []),
  }));

vi.mock('../../api/index.js', () => ({
  fetchAiModels: (...args) => fetchAiModelsMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../utils/aiSettings.js', () => ({
  saveFetchedModels: (...args) => saveFetchedModelsMock(...args),
  batchAddCustomModels: (...args) => batchAddCustomModelsMock(...args),
  getCustomModels: (...args) => getCustomModelsMock(...args),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const mountComposable = (form, refreshSettings = vi.fn()) => {
  let result;
  mount({
    template: '<div />',
    setup() {
      result = useAiModelFetch({ form, refreshSettings });
      return {};
    },
  });
  return { result, refreshSettings };
};

const makeForm = (overrides = {}) =>
  ref({
    providerId: 'openai',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: '',
    hasApiKey: true,
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  fetchAiModelsMock.mockResolvedValue({ data: { models: [] } });
});

describe('useAiModelFetch', () => {
  describe('autoFetchModels', () => {
    it('条件具备时静默拉取并写入 saveFetchedModels', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['gpt-4o', 'o1'] } });
      const form = makeForm();
      const { result, refreshSettings } = mountComposable(form);

      await result.autoFetchModels();
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'openai' })
      );
      expect(saveFetchedModelsMock).toHaveBeenCalledWith('openai', ['gpt-4o', 'o1']);
      expect(refreshSettings).toHaveBeenCalled();
    });

    it('拉取失败时静默吞错，不抛出', async () => {
      fetchAiModelsMock.mockRejectedValue(new Error('network'));
      const form = makeForm();
      const { result } = mountComposable(form);

      await expect(result.autoFetchModels()).resolves.toBeUndefined();
      expect(saveFetchedModelsMock).not.toHaveBeenCalled();
    });

    it('条件不具备（无 baseUrl）时不调 API', async () => {
      const form = makeForm({ baseUrl: '' });
      const { result } = mountComposable(form);

      await result.autoFetchModels();
      expect(fetchAiModelsMock).not.toHaveBeenCalled();
    });

    it('条件不具备（无 apiKey 且无 hasApiKey）时不调 API', async () => {
      const form = makeForm({ apiKey: '', hasApiKey: false });
      const { result } = mountComposable(form);

      await result.autoFetchModels();
      expect(fetchAiModelsMock).not.toHaveBeenCalled();
    });

    it('fetchingModels 锁定时跳过', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['m1'] } });
      const form = makeForm();
      const { result } = mountComposable(form);

      // 并发触发两次：第二次应被锁跳过
      const p1 = result.autoFetchModels();
      await result.autoFetchModels();
      await p1;
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledTimes(1);
    });

    it('拉取到空列表时不写 saveFetchedModels', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: [] } });
      const form = makeForm();
      const { result } = mountComposable(form);

      await result.autoFetchModels();
      expect(saveFetchedModelsMock).not.toHaveBeenCalled();
    });

    it('有 apiKey 时传入 apiKey，无 apiKey 时传 undefined', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: [] } });
      const form = makeForm({ apiKey: 'sk-real-key', hasApiKey: true });
      const { result } = mountComposable(form);

      await result.autoFetchModels();
      expect(fetchAiModelsMock.mock.calls[0][0]).toMatchObject({ apiKey: 'sk-real-key' });

      // 切换到仅 hasApiKey 场景
      form.value.apiKey = '';
      await result.autoFetchModels();
      expect(fetchAiModelsMock.mock.calls[1][0].apiKey).toBeUndefined();
    });
  });

  describe('handleApiKeyBlur (防抖)', () => {
    it('500ms 后触发 autoFetchModels', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['m1'] } });
      const form = makeForm();
      const { result } = mountComposable(form);

      result.handleApiKeyBlur();
      expect(fetchAiModelsMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledTimes(1);
    });

    it('防抖期间重复 blur 只触发一次', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['m1'] } });
      const form = makeForm();
      const { result } = mountComposable(form);

      result.handleApiKeyBlur();
      vi.advanceTimersByTime(300);
      result.handleApiKeyBlur();
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledTimes(0);

      vi.advanceTimersByTime(200);
      await flushPromises();

      expect(fetchAiModelsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleFetchModels (显式拉取对话框)', () => {
    it('条件具备时拉取并打开对话框', async () => {
      fetchAiModelsMock.mockResolvedValue({ data: { models: ['gpt-4o', 'o1'] } });
      const form = makeForm();
      const { result } = mountComposable(form);

      await result.handleFetchModels();
      await flushPromises();

      expect(result.showFetchModels.value).toBe(true);
      expect(result.dialogModels.value).toEqual(['gpt-4o', 'o1']);
    });

    it('条件不具备时提示警告且不调 API', async () => {
      const form = makeForm({ apiKey: '', hasApiKey: false });
      const { result } = mountComposable(form);

      await result.handleFetchModels();
      expect(fetchAiModelsMock).not.toHaveBeenCalled();
      expect(result.showFetchModels.value).toBe(false);
    });

    it('API 失败时关闭对话框', async () => {
      fetchAiModelsMock.mockRejectedValue({ response: { data: { msg: 'fail' } } });
      const form = makeForm();
      const { result } = mountComposable(form);

      await result.handleFetchModels();
      await flushPromises();

      expect(result.showFetchModels.value).toBe(false);
    });
  });

  describe('handleConfirmFetchModels', () => {
    it('选中模型后批量导入 customModels', async () => {
      batchAddCustomModelsMock.mockReturnValue(2);
      const form = makeForm();
      const { result, refreshSettings } = mountComposable(form);

      result.selectedFetchedModels.value = ['gpt-4o', 'o1'];
      result.handleConfirmFetchModels();

      expect(batchAddCustomModelsMock).toHaveBeenCalledWith('openai', ['gpt-4o', 'o1']);
      expect(refreshSettings).toHaveBeenCalled();
      expect(result.showFetchModels.value).toBe(false);
    });

    it('未选中模型时不调 batchAddCustomModels', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.selectedFetchedModels.value = [];
      result.handleConfirmFetchModels();

      expect(batchAddCustomModelsMock).not.toHaveBeenCalled();
    });
  });

  describe('toggleFetchedModel', () => {
    it('勾选时加入选中列表', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.toggleFetchedModel('gpt-4o', true);
      expect(result.selectedFetchedModels.value).toEqual(['gpt-4o']);
    });

    it('取消勾选时移除', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.selectedFetchedModels.value = ['gpt-4o', 'o1'];
      result.toggleFetchedModel('gpt-4o', false);
      expect(result.selectedFetchedModels.value).toEqual(['o1']);
    });

    it('重复勾选同一模型不重复加入', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.toggleFetchedModel('gpt-4o', true);
      result.toggleFetchedModel('gpt-4o', true);
      expect(result.selectedFetchedModels.value).toEqual(['gpt-4o']);
    });
  });

  describe('filteredFetchedModels', () => {
    it('标记已在 customModels 中的模型为 exists', () => {
      getCustomModelsMock.mockReturnValue(['gpt-4o']);
      const form = makeForm();
      const { result } = mountComposable(form);

      result.dialogModels.value = ['gpt-4o', 'o1'];
      result.fetchModelsSearch.value = '';

      const filtered = result.filteredFetchedModels.value;
      expect(filtered).toEqual([
        { name: 'gpt-4o', exists: true },
        { name: 'o1', exists: false },
      ]);
    });

    it('按关键字过滤', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.dialogModels.value = ['gpt-4o', 'gpt-4o-mini', 'o1'];
      result.fetchModelsSearch.value = 'gpt';

      const filtered = result.filteredFetchedModels.value;
      expect(filtered.map((f) => f.name)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });
  });

  describe('resetFetchModelsState', () => {
    it('清空对话框状态', () => {
      const form = makeForm();
      const { result } = mountComposable(form);

      result.dialogModels.value = ['m1'];
      result.selectedFetchedModels.value = ['m1'];
      result.fetchModelsSearch.value = 'gpt';

      result.resetFetchModelsState();

      expect(result.dialogModels.value).toEqual([]);
      expect(result.selectedFetchedModels.value).toEqual([]);
      expect(result.fetchModelsSearch.value).toBe('');
    });
  });
});
