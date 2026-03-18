<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item v-if="word?.roots?.length === 1" :to="{ path: `/root/${word.roots[0].id}` }">词根详情</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: `/word/${wordId}` }">单词详情</el-breadcrumb-item>
      <el-breadcrumb-item>智能添加例句</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="ai-card">
      <template #header>
        <div class="page-heading page-heading-between">
          <div>
            <h2>智能添加例句</h2>
            <p v-if="word">AI 会围绕单词“{{ word.name }}”补充常见、自然的英文例句。</p>
          </div>
          <div class="page-actions">
            <el-button @click="$router.push('/ai/settings')">修改配置</el-button>
            <el-button @click="$router.push(`/word/${wordId}`)">返回单词</el-button>
            <el-button type="primary" :loading="loading" @click="generateSuggestions">重新生成</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="!ready"
        type="warning"
        :closable="false"
        title="尚未完成 AI 配置，请先配置后再生成建议。"
        show-icon
      />

      <template v-else>
        <div class="config-strip">
          <el-tag type="success">{{ providerName }}</el-tag>
          <span>模型：{{ settings.model }}</span>
          <span v-if="word">当前单词：{{ word.name }}</span>
          <span>现有例句：{{ exampleCount }}</span>
          <span v-if="debugSummary">耗时：{{ debugSummary.durationMs }} ms</span>
        </div>

        <el-alert
          v-if="resultMessage"
          :title="resultMessage"
          :type="suggestions.length ? 'success' : 'info'"
          :closable="false"
          show-icon
          class="result-alert"
        />

        <div v-if="suggestions.length" class="example-list ai-suggestion-list">
          <el-card v-for="item in suggestions" :key="item.sentence" class="example-card" shadow="hover">
            <div class="example-content">
              <p class="example-sentence">{{ item.sentence }}</p>
              <p class="example-translation">{{ item.translation }}</p>

            </div>
            <div class="example-actions">
              <SpeakButton :text="item.sentence" />
              <el-checkbox :model-value="selectedMap[item.sentence]" @change="toggleSelection(item)">选择</el-checkbox>
            </div>
          </el-card>
        </div>

        <div v-if="suggestions.length" class="page-actions ai-footer-actions">
          <el-button @click="toggleAllSelection">{{ allSelected ? '取消全选' : '全选建议' }}</el-button>
          <el-button type="primary" :loading="saving" @click="handleSaveSelected">保存选中例句</el-button>
        </div>

      </template>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { createExample, getAiExampleSuggestions, getExamples, getWord } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';
import { getProviderById } from '../constants/aiProviders.js';
import { isAiSettingsReady, loadAiSettings } from '../utils/aiSettings.js';

const route = useRoute();
const wordId = route.params.id;

const settings = ref(loadAiSettings());
const ready = computed(() => isAiSettingsReady(settings.value));
const providerName = computed(() => getProviderById(settings.value.providerId).name);

const word = ref(null);
const exampleCount = ref(0);
const loading = ref(false);
const saving = ref(false);
const suggestions = ref([]);
const selectedRows = ref([]);
const selectedMap = ref({});
const resultMessage = ref('');
const debugSummary = ref(null);

const allSelected = computed(() => suggestions.value.length > 0 && selectedRows.value.length === suggestions.value.length);

const fetchBaseData = async () => {
  try {
    const [wordRes, examplesRes] = await Promise.all([
      getWord(wordId),
      getExamples({ wordId }),
    ]);
    word.value = wordRes.data;
    exampleCount.value = examplesRes.data.length;
  } catch {
    ElMessage.error('获取单词数据失败');
  }
};

const syncSelectedMap = () => {
  selectedMap.value = selectedRows.value.reduce((accumulator, item) => {
    accumulator[item.sentence] = true;
    return accumulator;
  }, {});
};

const toggleSelection = (item) => {
  const exists = selectedRows.value.some((selected) => selected.sentence === item.sentence);
  selectedRows.value = exists
    ? selectedRows.value.filter((selected) => selected.sentence !== item.sentence)
    : [...selectedRows.value, item];
  syncSelectedMap();
};

const toggleAllSelection = () => {
  selectedRows.value = allSelected.value ? [] : [...suggestions.value];
  syncSelectedMap();
};

const generateSuggestions = async () => {
  if (!ready.value) {
    return ElMessage.warning('请先完成 AI 配置');
  }

  loading.value = true;
  suggestions.value = [];
  selectedRows.value = [];
  selectedMap.value = {};
  resultMessage.value = '';
  debugSummary.value = null;

  try {
    const res = await getAiExampleSuggestions(wordId, settings.value);
    suggestions.value = res.data.items || [];
    resultMessage.value = res.data.message || '建议生成完成';
    debugSummary.value = res.data.debug || null;
  } catch (e) {
    resultMessage.value = '';
    ElMessage.error(e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '生成例句建议失败'));
  } finally {
    loading.value = false;
  }
};

const handleSaveSelected = async () => {
  if (!selectedRows.value.length) {
    return ElMessage.warning('请先选择至少一条例句');
  }

  saving.value = true;
  try {
    const results = await Promise.allSettled(
      selectedRows.value.map((item) => createExample({
        wordId,
        sentence: item.sentence,
        translation: item.translation,
        remark: item.remark,
      }))
    );

    const successCount = results.filter((item) => item.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    suggestions.value = suggestions.value.filter(
      (item) => !selectedRows.value.some((selected) => selected.sentence === item.sentence)
    );
    selectedRows.value = [];
    selectedMap.value = {};
    exampleCount.value += successCount;

    if (successCount) {
      ElMessage.success(`已保存 ${successCount} 条例句`);
    }
    if (failedCount) {
      ElMessage.warning(`${failedCount} 条例句保存失败，可能已存在`);
    }
    if (!suggestions.value.length) {
      resultMessage.value = '当前这批建议已处理完成，如需更多建议可以再次生成';
    }
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await fetchBaseData();
  if (ready.value) {
    generateSuggestions();
  }
});
</script>