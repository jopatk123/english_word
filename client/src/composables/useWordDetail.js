import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getWord,
  getExamples,
  getRoots,
  createWord,
  updateWord,
  deleteWord,
  createExample,
  updateExample,
  deleteExample,
  getAiExampleSuggestions,
} from '../api/index.js';
import {
  isAiSettingsReady,
  loadAiSettings,
  refreshAiSettings,
  subscribeAiSettingsChanges,
} from '../utils/aiSettings.js';

export function useWordDetail(wordId) {
  const router = useRouter();

  const word = ref(null);
  const examples = ref([]);
  const loading = ref(false);
  const examplesLoading = ref(false);

  const rootDialogVisible = ref(false);
  const selectedRootId = ref(null);
  const addingRoot = ref(false);
  const allRoots = ref([]);
  const allRootsLoading = ref(false);
  const deleteRootDialogVisible = ref(false);
  const selectedDeleteRootId = ref(null);
  const deletingRoot = ref(false);

  const existingRootIds = computed(() => new Set((word.value?.roots || []).map((root) => root.id)));
  const availableRoots = computed(() =>
    allRoots.value.filter((rootItem) => !existingRootIds.value.has(rootItem.id))
  );
  const associatedRoots = computed(() => word.value?.roots || []);

  const exampleDialogVisible = ref(false);
  const editingExample = ref(null);
  const exampleForm = ref({ sentence: '', translation: '', remark: '' });
  const saving = ref(false);
  const regeneratingExampleId = ref(null);
  const aiSettings = ref(loadAiSettings());
  let stopAiSettingsSync = () => {};

  const syncAiSettings = (nextSettings) => {
    aiSettings.value = nextSettings || loadAiSettings();
  };

  const fetchWord = async () => {
    loading.value = true;
    try {
      const res = await getWord(wordId);
      word.value = res.data;
    } catch {
      ElMessage.error('获取单词信息失败');
    } finally {
      loading.value = false;
    }
  };

  const fetchExamples = async () => {
    examplesLoading.value = true;
    try {
      const res = await getExamples({ wordId });
      examples.value = res.data;
    } catch {
      ElMessage.error('获取例句列表失败');
    } finally {
      examplesLoading.value = false;
    }
  };

  const fetchRoots = async () => {
    allRootsLoading.value = true;
    try {
      const res = await getRoots();
      allRoots.value = res.data || [];
    } catch {
      ElMessage.error('获取词根列表失败');
    } finally {
      allRootsLoading.value = false;
    }
  };

  const normalizeSentence = (sentence) => `${sentence || ''}`.trim().toLowerCase();

  const getExcludedSentences = (extraSentences = []) => {
    const sentences = [
      ...examples.value.map((item) => item?.sentence).filter(Boolean),
      ...extraSentences.filter(Boolean),
    ];
    return [...new Set(sentences)];
  };

  const requestReplacementExample = async () => {
    const existingSentenceSet = new Set(
      getExcludedSentences().map((sentence) => normalizeSentence(sentence))
    );
    let excludedSentences = getExcludedSentences();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await getAiExampleSuggestions(wordId, aiSettings.value, {
        excludedSentences,
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const candidate = items.find((item) => {
        if (!item?.sentence || !item?.translation) return false;
        return !existingSentenceSet.has(normalizeSentence(item.sentence));
      });

      if (candidate) {
        return candidate;
      }

      const returnedSentences = items.map((item) => item?.sentence).filter(Boolean);
      excludedSentences = getExcludedSentences(returnedSentences);
    }

    return null;
  };

  const openExampleDialog = (example = null) => {
    editingExample.value = example;
    exampleForm.value = example
      ? {
          sentence: example.sentence,
          translation: example.translation,
          remark: example.remark || '',
        }
      : { sentence: '', translation: '', remark: '' };
    exampleDialogVisible.value = true;
  };

  const openRootDialog = async () => {
    if (!word.value) {
      return ElMessage.warning('请先等待单词信息加载完成');
    }

    rootDialogVisible.value = true;
    selectedRootId.value = null;

    if (allRoots.value.length === 0) {
      await fetchRoots();
    }
  };

  const openDeleteRootDialog = () => {
    if (!associatedRoots.value.length) {
      return ElMessage.warning('当前没有可删除的词根');
    }

    deleteRootDialogVisible.value = true;
    selectedDeleteRootId.value = null;
  };

  const handleAddRoot = async () => {
    if (!selectedRootId.value) {
      return ElMessage.warning('请选择词根');
    }

    addingRoot.value = true;
    try {
      const res = await createWord({
        name: word.value.name,
        meaning: word.value.meaning,
        phonetic: word.value.phonetic,
        remark: word.value.remark,
        rootId: selectedRootId.value,
      });
      rootDialogVisible.value = false;
      ElMessage.success(res?.msg || '添加成功');
      await fetchWord();
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '添加词根失败');
    } finally {
      addingRoot.value = false;
    }
  };

  const handleDeleteRoot = async () => {
    if (!selectedDeleteRootId.value) {
      return ElMessage.warning('请选择要删除的词根');
    }

    const targetRoot = associatedRoots.value.find(
      (rootItem) => rootItem.id === selectedDeleteRootId.value
    );
    if (!targetRoot) {
      return ElMessage.warning('请选择当前已关联的词根');
    }

    const isLastRoot = associatedRoots.value.length === 1;
    const confirmText = isLastRoot
      ? `删除词根「${targetRoot.name}」后，单词「${word.value.name}」、关联例句和复习记录将一并删除，确定继续？`
      : `确定将单词「${word.value.name}」从词根「${targetRoot.name}」中移除？`;

    try {
      await ElMessageBox.confirm(confirmText, '确认删除', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }

    deletingRoot.value = true;
    try {
      if (isLastRoot) {
        await deleteWord(wordId);
        deleteRootDialogVisible.value = false;
        ElMessage.success('删除成功，单词、例句和复习记录已同步删除');
        await router.push('/');
        return;
      }

      const remainingRootIds = associatedRoots.value
        .filter((rootItem) => rootItem.id !== targetRoot.id)
        .map((rootItem) => rootItem.id);

      await updateWord(wordId, {
        name: word.value.name,
        meaning: word.value.meaning,
        phonetic: word.value.phonetic,
        remark: word.value.remark,
        rootIds: remainingRootIds,
      });

      deleteRootDialogVisible.value = false;
      ElMessage.success('删除成功');
      await fetchWord();
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '删除词根失败');
    } finally {
      deletingRoot.value = false;
    }
  };

  const handleSaveExample = async () => {
    if (!exampleForm.value.sentence || !exampleForm.value.translation) {
      return ElMessage.warning('请填写例句原文和翻译');
    }
    saving.value = true;
    try {
      if (editingExample.value) {
        await updateExample(editingExample.value.id, exampleForm.value);
        ElMessage.success('更新成功');
      } else {
        await createExample({ ...exampleForm.value, wordId });
        ElMessage.success('添加成功');
      }
      exampleDialogVisible.value = false;
      fetchExamples();
    } catch {
      ElMessage.error('保存失败');
    } finally {
      saving.value = false;
    }
  };

  const handleDeleteExample = async (example) => {
    try {
      await ElMessageBox.confirm('确定删除这条例句？', '确认删除', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
      await deleteExample(example.id);
      ElMessage.success('删除成功');
      fetchExamples();
    } catch {
      // 取消
    }
  };

  const handleRegenerateExample = async (example) => {
    if (!isAiSettingsReady(aiSettings.value)) {
      return ElMessage.warning('请先完成 AI 配置');
    }

    regeneratingExampleId.value = example.id;
    try {
      const nextExample = await requestReplacementExample();
      if (!nextExample) {
        return ElMessage.warning('没有生成新的不重复例句，请稍后再试');
      }

      await updateExample(example.id, {
        sentence: nextExample.sentence,
        translation: nextExample.translation,
        remark: example.remark || '',
      });
      await fetchExamples();
      ElMessage.success('已重新生成该例句');
    } catch (e) {
      ElMessage.error(
        e?.response?.data?.msg ||
          (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '重新生成例句失败')
      );
    } finally {
      regeneratingExampleId.value = null;
    }
  };

  onMounted(async () => {
    stopAiSettingsSync = subscribeAiSettingsChanges(syncAiSettings);
    aiSettings.value = await refreshAiSettings();
    await Promise.all([fetchWord(), fetchExamples()]);
  });

  onUnmounted(() => {
    stopAiSettingsSync();
  });

  return {
    word,
    examples,
    loading,
    examplesLoading,
    rootDialogVisible,
    selectedRootId,
    addingRoot,
    allRoots,
    allRootsLoading,
    deleteRootDialogVisible,
    selectedDeleteRootId,
    deletingRoot,
    availableRoots,
    associatedRoots,
    exampleDialogVisible,
    editingExample,
    exampleForm,
    saving,
    regeneratingExampleId,
    openExampleDialog,
    openRootDialog,
    openDeleteRootDialog,
    handleAddRoot,
    handleDeleteRoot,
    handleSaveExample,
    handleDeleteExample,
    handleRegenerateExample,
    // 仅供测试使用的内部状态设置器
    setWordForTest: (value) => { word.value = value; },
    setSelectedRootIdForTest: (value) => { selectedRootId.value = value; },
    setSelectedDeleteRootIdForTest: (value) => { selectedDeleteRootId.value = value; },
  };
}
