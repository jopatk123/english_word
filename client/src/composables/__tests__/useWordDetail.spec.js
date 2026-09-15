import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWordDetail } from '../useWordDetail.js';

const getWordMock = vi.fn().mockResolvedValue({ data: { id: 1, name: 'stable', meaning: '稳定的' } });
const getExamplesMock = vi.fn().mockResolvedValue({ data: [] });
const getAiExampleSuggestionsMock = vi.fn();
const updateExampleMock = vi.fn().mockResolvedValue({});

vi.mock('../../api/index.js', () => ({
  getWord: (...args) => getWordMock(...args),
  getExamples: (...args) => getExamplesMock(...args),
  getRoots: vi.fn().mockResolvedValue({ data: [] }),
  createWord: vi.fn(),
  updateWord: vi.fn(),
  deleteWord: vi.fn(),
  createExample: vi.fn(),
  updateExample: (...args) => updateExampleMock(...args),
  deleteExample: vi.fn(),
  getAiExampleSuggestions: (...args) => getAiExampleSuggestionsMock(...args),
}));

vi.mock('../../utils/aiSettings.js', () => ({
  isAiSettingsReady: (settings) => Boolean(settings?.model),
  loadAiSettings: () => ({ providerId: 'openai', model: 'gpt-test' }),
  refreshAiSettings: () => Promise.resolve({ providerId: 'openai', model: 'gpt-test' }),
  subscribeAiSettingsChanges: () => () => {},
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useWordDetail handleRegenerateExample', () => {
  const example = {
    id: 11,
    sentence: 'Old sentence.',
    translation: '旧句子。',
    remark: '备注',
  };

  const mountWordDetail = async () => {
    const wrapper = mount({
      template: '<div />',
      setup() {
        return useWordDetail(1);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.vm.examples = [example];
    return wrapper;
  };

  beforeEach(() => {
    getAiExampleSuggestionsMock.mockReset();
    updateExampleMock.mockClear();
    getExamplesMock.mockResolvedValue({ data: [example] });
  });

  it('进行中的重新生成会忽略后续并发调用', async () => {
    let unblockFirstRequest;
    const firstRequestGate = new Promise((resolve) => {
      unblockFirstRequest = resolve;
    });

    getAiExampleSuggestionsMock.mockImplementation(() =>
      firstRequestGate.then(() => ({
        data: { items: [{ sentence: 'Brand new sentence.', translation: '全新句子。' }] },
      }))
    );

    const wrapper = await mountWordDetail();
    const firstCall = wrapper.vm.handleRegenerateExample(example);
    await Promise.resolve();

    expect(wrapper.vm.regeneratingExampleId).toBe(example.id);
    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(1);

    const secondCall = wrapper.vm.handleRegenerateExample(example);
    await Promise.resolve();

    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(1);
    expect(updateExampleMock).not.toHaveBeenCalled();

    unblockFirstRequest();
    await firstCall;
    await secondCall;

    expect(getAiExampleSuggestionsMock).toHaveBeenCalledTimes(1);
    expect(updateExampleMock).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.regeneratingExampleId).toBeNull();

    wrapper.unmount();
  });
});
