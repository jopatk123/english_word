import { computed, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchAiModels } from '../api/index.js';
import { batchAddCustomModels, getCustomModels, saveFetchedModels } from '../utils/aiSettings.js';

const DEBOUNCE_MS = 500;

/**
 * 模型拉取 composable，封装两类拉取行为：
 *
 * 1. autoFetchModels —— 静默拉取：厂商切换 / API Key blur 防抖 / mount 时触发，
 *    结果直接写入 fetchedModels 持久化，不弹对话框、不要求确认。
 * 2. handleFetchModels —— 显式拉取：用户点击"自动获取模型"按钮触发，
 *    结果写入对话框待用户勾选后导入 customModels。
 *
 * 两者共享 fetchingModels 锁，避免并发请求。
 *
 * @param {{
 *   form: import('vue').Ref<object>,
 *   refreshSettings: () => void,
 * }} ctx
 */
export function useAiModelFetch({ form, refreshSettings }) {
  const fetchingModels = ref(false);

  // --- 显式拉取对话框状态 ---
  const showFetchModels = ref(false);
  const dialogModels = ref([]);
  const selectedFetchedModels = ref([]);
  const fetchModelsSearch = ref('');

  const filteredFetchedModels = computed(() => {
    const existing = new Set(getCustomModels(form.value.providerId));
    const keyword = fetchModelsSearch.value.trim().toLowerCase();
    return dialogModels.value
      .filter((name) => !keyword || name.toLowerCase().includes(keyword))
      .map((name) => ({ name, exists: existing.has(name) }));
  });

  const resetFetchModelsState = () => {
    dialogModels.value = [];
    selectedFetchedModels.value = [];
    fetchModelsSearch.value = '';
  };

  const buildFetchPayload = () =>
    form.value.apiKey ? form.value : { ...form.value, apiKey: undefined };

  const canFetch = () => {
    const settings = form.value || {};
    return Boolean(settings.baseUrl && (settings.apiKey || settings.hasApiKey));
  };

  /**
   * 静默拉取模型列表并写入 fetchedModels 持久化。
   * 失败时不弹错误（部分厂商 /models 端点不支持，属正常情况）。
   */
  const autoFetchModels = async () => {
    if (fetchingModels.value) return;
    if (!canFetch()) return;

    fetchingModels.value = true;
    try {
      const res = await fetchAiModels(buildFetchPayload());
      const models = Array.isArray(res?.data?.models) ? res.data.models : [];
      if (models.length) {
        saveFetchedModels(form.value.providerId, models);
        refreshSettings();
      }
    } catch {
      // 静默吞错：自动拉取是辅助行为，不应打断用户
    } finally {
      fetchingModels.value = false;
    }
  };

  // --- API Key 输入框防抖 ---
  let debounceTimer = null;
  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  /**
   * API Key 输入框失焦时防抖触发自动拉取。
   * 防抖期间重复 blur 只触发一次。
   */
  const handleApiKeyBlur = () => {
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void autoFetchModels();
    }, DEBOUNCE_MS);
  };

  /**
   * 显式拉取模型列表并打开对话框，供用户勾选导入。
   */
  const handleFetchModels = async () => {
    if (!canFetch()) {
      return ElMessage.warning('请先填写 Base URL，并至少提供一个可用的 API Key');
    }

    fetchingModels.value = true;
    showFetchModels.value = true;
    try {
      const res = await fetchAiModels(buildFetchPayload());
      dialogModels.value = Array.isArray(res?.data?.models) ? res.data.models : [];
      if (!dialogModels.value.length) ElMessage.warning('未获取到任何模型');
    } catch (e) {
      ElMessage.error(
        e?.response?.data?.msg ||
          (e?.code === 'ECONNABORTED' ? '获取模型列表超时，请稍后重试' : '获取模型列表失败')
      );
      showFetchModels.value = false;
    } finally {
      fetchingModels.value = false;
    }
  };

  const handleConfirmFetchModels = () => {
    if (!selectedFetchedModels.value.length) return;
    const added = batchAddCustomModels(form.value.providerId, selectedFetchedModels.value);
    refreshSettings();
    showFetchModels.value = false;
    if (added > 0) ElMessage.success(`成功导入 ${added} 个模型`);
    else ElMessage.info('所选模型均已存在，未新增');
  };

  const toggleFetchedModel = (name, checked) => {
    if (checked) {
      if (!selectedFetchedModels.value.includes(name)) {
        selectedFetchedModels.value = [...selectedFetchedModels.value, name];
      }
    } else {
      selectedFetchedModels.value = selectedFetchedModels.value.filter((n) => n !== name);
    }
  };

  onUnmounted(clearDebounce);

  return {
    fetchingModels,
    showFetchModels,
    dialogModels,
    selectedFetchedModels,
    fetchModelsSearch,
    filteredFetchedModels,
    resetFetchModelsState,
    autoFetchModels,
    handleApiKeyBlur,
    handleFetchModels,
    handleConfirmFetchModels,
    toggleFetchedModel,
  };
}
