import { computed, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchAiModels } from '../api/index.js';
import { batchAddCustomModels, getAllModels, saveFetchedModels } from '../utils/aiSettings.js';

const DEBOUNCE_MS = 500;

/**
 * 模型拉取 composable，封装两类拉取行为：
 *
 * 1. autoFetchModels —— 静默拉取：厂商切换 / API Key blur / Base URL blur 防抖 / mount 时触发，
 *    结果直接写入 fetchedModels 持久化，不弹对话框、不要求确认。
 * 2. handleFetchModels —— 显式拉取：用户点击"自动获取模型"按钮触发，
 *    结果写入对话框待用户勾选后导入 customModels。
 *
 * 使用 generation 丢弃过期响应，避免厂商切换时的竞态写入。
 *
 * @param {{
 *   form: import('vue').Ref<object>,
 *   refreshSettings: () => void,
 * }} ctx
 */
export function useAiModelFetch({ form, refreshSettings }) {
  const fetchingModels = ref(false);
  let fetchGeneration = 0;

  // --- 显式拉取对话框状态 ---
  const showFetchModels = ref(false);
  const dialogModels = ref([]);
  const selectedFetchedModels = ref([]);
  const fetchModelsSearch = ref('');

  const filteredFetchedModels = computed(() => {
    const existing = new Set(getAllModels(form.value.providerId));
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

  const applyFetchedModels = (providerId, models) => {
    if (!models.length) return;

    saveFetchedModels(providerId, models);
    refreshSettings();

    if (form.value.providerId === providerId && !form.value.model) {
      form.value.model = models[0];
    }
  };

  const fetchModelsForCurrentProvider = async ({ silent = false } = {}) => {
    if (!canFetch()) return null;

    const generation = ++fetchGeneration;
    const { providerId, baseUrl } = form.value;
    const payload = buildFetchPayload();

    fetchingModels.value = true;
    try {
      const res = await fetchAiModels(payload);
      if (generation !== fetchGeneration) return null;
      if (form.value.providerId !== providerId || form.value.baseUrl !== baseUrl) return null;

      const models = Array.isArray(res?.data?.models) ? res.data.models : [];
      if (models.length) {
        applyFetchedModels(providerId, models);
      }
      return models;
    } catch (e) {
      if (!silent) throw e;
      return null;
    } finally {
      if (generation === fetchGeneration) {
        fetchingModels.value = false;
      }
    }
  };

  /**
   * 静默拉取模型列表并写入 fetchedModels 持久化。
   * 失败时不弹错误（部分厂商 /models 端点不支持，属正常情况）。
   */
  const autoFetchModels = async () => {
    await fetchModelsForCurrentProvider({ silent: true });
  };

  // --- API Key / Base URL 输入框防抖 ---
  let debounceTimer = null;
  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const scheduleAutoFetch = () => {
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void autoFetchModels();
    }, DEBOUNCE_MS);
  };

  /**
   * API Key 输入框失焦时防抖触发自动拉取。
   */
  const handleApiKeyBlur = () => {
    scheduleAutoFetch();
  };

  /**
   * Base URL 输入框失焦时防抖触发自动拉取。
   */
  const handleBaseUrlBlur = () => {
    scheduleAutoFetch();
  };

  /**
   * 显式拉取模型列表并打开对话框，供用户勾选导入。
   */
  const handleFetchModels = async () => {
    if (!canFetch()) {
      return ElMessage.warning('请先填写 Base URL，并至少提供一个可用的 API Key');
    }

    if (fetchingModels.value) {
      return ElMessage.info('正在拉取模型列表，请稍候');
    }

    showFetchModels.value = true;
    try {
      const models = (await fetchModelsForCurrentProvider({ silent: false })) || [];
      dialogModels.value = models;
      if (!dialogModels.value.length) ElMessage.warning('未获取到任何模型');
    } catch (e) {
      ElMessage.error(
        e?.response?.data?.msg ||
          (e?.code === 'ECONNABORTED' ? '获取模型列表超时，请稍后重试' : '获取模型列表失败')
      );
      showFetchModels.value = false;
    }
  };

  const handleConfirmFetchModels = () => {
    if (!selectedFetchedModels.value.length) return;

    const existing = new Set(getAllModels(form.value.providerId));
    const toAdd = selectedFetchedModels.value.filter((name) => !existing.has(name));
    if (!toAdd.length) {
      showFetchModels.value = false;
      return ElMessage.info('所选模型均已存在，未新增');
    }

    const added = batchAddCustomModels(form.value.providerId, toAdd);
    refreshSettings();
    showFetchModels.value = false;

    if (!form.value.model) {
      form.value.model = toAdd[0];
    }

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
    handleBaseUrlBlur,
    handleFetchModels,
    handleConfirmFetchModels,
    toggleFetchedModel,
  };
}
