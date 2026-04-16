<template>
  <div class="detail-view">
    <!-- 面包屑导航 -->
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item
        v-if="word?.roots?.length === 1"
        :to="{ path: `/root/${word.roots[0].id}` }"
      >
        词根：{{ word.roots[0].name }}
      </el-breadcrumb-item>
      <el-breadcrumb-item v-else>单词详情</el-breadcrumb-item>
      <el-breadcrumb-item>单词：{{ word?.name }}</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 单词信息卡片 -->
    <el-card class="info-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span class="root-name">{{ word?.name }}</span>
          <span v-if="word?.phonetic" class="phonetic">{{ word.phonetic }}</span>
          <SpeakButton v-if="word?.name" :text="word.name" />
          <span class="root-meaning">— {{ word?.meaning }}</span>
        </div>
      </template>
      <p class="remark-text">
        所属词根：
        <template v-for="(root, idx) in word?.roots || []" :key="root.id">
          <el-link type="primary" @click="$router.push(`/root/${root.id}`)">
            {{ root.name }}（{{ root.meaning }}）
          </el-link>
          <span v-if="idx < word.roots.length - 1">、</span>
        </template>
        <span v-if="!word?.roots?.length">无</span>
      </p>
      <p v-if="word?.remark" class="remark-text">备注：{{ word.remark }}</p>
    </el-card>

    <!-- 例句列表 -->
    <div class="section-header">
      <h3>例句（{{ examples.length }}）</h3>
      <div class="section-actions">
        <el-button
          v-if="word?.roots?.length === 1"
          type="info"
          @click="$router.push(`/root/${word.roots[0].id}`)"
          >返回词根</el-button
        >
        <el-button v-else type="info" @click="$router.push('/')">返回首页</el-button>
        <el-button type="success" @click="$router.push(`/word/${wordId}/ai-examples`)"
          >智能添加例句</el-button
        >
        <el-button type="warning" @click="openRootDialog()">添加词根</el-button>
        <el-button type="danger" @click="openDeleteRootDialog()">删除词根</el-button>
        <el-button type="primary" @click="openExampleDialog()">添加例句</el-button>
      </div>
    </div>

    <div v-if="examples.length === 0 && !examplesLoading" class="empty-tip">
      暂无例句，点击"添加例句"开始吧
    </div>

    <div v-loading="examplesLoading" class="example-list">
      <el-card v-for="example in examples" :key="example.id" class="example-card" shadow="hover">
        <div class="example-content">
          <p class="example-sentence">{{ example.sentence }}</p>
          <p class="example-translation">{{ example.translation }}</p>
          <p v-if="example.remark" class="example-remark">
            <el-tag size="small" type="info">{{ example.remark }}</el-tag>
          </p>
        </div>
        <div class="example-actions">
          <SpeakButton :text="example.sentence" />
          <el-button
            link
            type="success"
            :loading="regeneratingExampleId === example.id"
            @click="handleRegenerateExample(example)"
            >重新生成</el-button
          >
          <el-button link type="primary" @click="openExampleDialog(example)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteExample(example)">删除</el-button>
        </div>
      </el-card>
    </div>

    <!-- 例句表单对话框 -->
    <el-dialog
      v-model="exampleDialogVisible"
      :title="editingExample ? '编辑例句' : '添加例句'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="exampleForm" label-width="80px">
        <el-form-item label="例句原文" required>
          <el-input
            v-model="exampleForm.sentence"
            type="textarea"
            :rows="3"
            placeholder="英文例句"
          />
        </el-form-item>
        <el-form-item label="翻译" required>
          <el-input
            v-model="exampleForm.translation"
            type="textarea"
            :rows="2"
            placeholder="中文翻译"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="exampleForm.remark" placeholder="如：高频考点、来源等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exampleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveExample" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加词根对话框 -->
    <el-dialog v-model="rootDialogVisible" title="添加到词根" width="420px" destroy-on-close>
      <p style="margin: 0 0 12px; color: #606266">
        将 <strong>{{ word?.name }}</strong> 添加到已有词根中：
      </p>
      <el-select
        v-model="selectedRootId"
        placeholder="请选择词根"
        filterable
        clearable
        style="width: 100%"
        :loading="allRootsLoading"
        no-data-text="暂无可选词根"
      >
        <el-option
          v-for="rootItem in availableRoots"
          :key="rootItem.id"
          :label="rootItem.name + (rootItem.meaning ? ' — ' + rootItem.meaning : '')"
          :value="rootItem.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="rootDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addingRoot" @click="handleAddRoot">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 删除词根对话框 -->
    <el-dialog v-model="deleteRootDialogVisible" title="删除词根" width="420px" destroy-on-close>
      <p style="margin: 0 0 12px; color: #606266">
        从 <strong>{{ word?.name }}</strong> 中移除一个已关联的词根：
      </p>
      <el-select
        v-model="selectedDeleteRootId"
        placeholder="请选择要删除的词根"
        filterable
        clearable
        style="width: 100%"
        no-data-text="暂无可删除的词根"
      >
        <el-option
          v-for="rootItem in associatedRoots"
          :key="rootItem.id"
          :label="rootItem.name + (rootItem.meaning ? ' — ' + rootItem.meaning : '')"
          :value="rootItem.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="deleteRootDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deletingRoot" @click="handleDeleteRoot"
          >确认删除</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { computed, ref, onMounted, onUnmounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
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
  import SpeakButton from '../components/SpeakButton.vue';
  import {
    isAiSettingsReady,
    loadAiSettings,
    subscribeAiSettingsChanges,
  } from '../utils/aiSettings.js';

  const props = defineProps({ id: String });
  const route = useRoute();
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

  const wordId = props.id || route.params.id;

  const syncAiSettings = () => {
    aiSettings.value = loadAiSettings();
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

    const targetRoot = associatedRoots.value.find((rootItem) => rootItem.id === selectedDeleteRootId.value);
    if (!targetRoot) {
      return ElMessage.warning('请选择当前已关联的词根');
    }

    const isLastRoot = associatedRoots.value.length === 1;
    const confirmText = isLastRoot
      ? `删除词根「${targetRoot.name}」后，单词「${word.value.name}」和关联例句将一并删除，确定继续？`
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
        ElMessage.success('删除成功，单词和例句已同步删除');
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

  onMounted(() => {
    stopAiSettingsSync = subscribeAiSettingsChanges(syncAiSettings);
    fetchWord();
    fetchExamples();
  });

  onUnmounted(() => {
    stopAiSettingsSync();
  });

  defineExpose({
    setWordForTest: (value) => {
      word.value = value;
    },
    setSelectedRootIdForTest: (value) => {
      selectedRootId.value = value;
    },
    setSelectedDeleteRootIdForTest: (value) => {
      selectedDeleteRootId.value = value;
    },
    handleAddRoot,
    handleDeleteRoot,
    openRootDialog,
    openDeleteRootDialog,
  });
</script>
