<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: `/root/${rootId}` }">词根详情</el-breadcrumb-item>
      <el-breadcrumb-item>智能添加单词</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="ai-card">
      <template #header>
        <div class="page-heading page-heading-between">
          <div>
            <h2>智能添加单词</h2>
            <p v-if="root">AI 会围绕词根“{{ root.name }}（{{ root.meaning }}）”补充常用单词。</p>
          </div>
          <div class="page-actions">
            <el-button @click="$router.push('/ai/settings')">修改配置</el-button>
            <el-button @click="$router.push(`/root/${rootId}`)">返回词根</el-button>
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
          <span v-if="root">当前词根：{{ root.name }}</span>
          <span>现有单词：{{ wordCount }}</span>
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

        <el-table
          v-if="suggestions.length"
          ref="tableRef"
          :data="suggestions"
          stripe
          class="suggestion-table"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="单词" min-width="140" />
          <el-table-column prop="meaning" label="含义" min-width="180" />
          <el-table-column prop="phonetic" label="音标" min-width="140" />
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
          <el-table-column prop="reason" label="推荐理由" min-width="180" show-overflow-tooltip />
        </el-table>

        <div v-if="suggestions.length" class="page-actions ai-footer-actions">
          <el-button @click="toggleAllSelection">{{ allSelected ? '取消全选' : '全选建议' }}</el-button>
          <el-button type="primary" :loading="saving" @click="handleSaveSelected">保存选中单词</el-button>
        </div>

        <el-card v-if="debugText" class="ai-debug-card">
          <template #header>
            <span>调试输出</span>
          </template>
          <pre class="debug-output">{{ debugText }}</pre>
        </el-card>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { createWord, getAiWordSuggestions, getRoot, getWords } from '../api/index.js';
import { getProviderById } from '../constants/aiProviders.js';
import { isAiSettingsReady, loadAiSettings } from '../utils/aiSettings.js';

const route = useRoute();
const rootId = route.params.id;

const settings = ref(loadAiSettings());
const ready = computed(() => isAiSettingsReady(settings.value));
const providerName = computed(() => getProviderById(settings.value.providerId).name);

const root = ref(null);
const wordCount = ref(0);
const loading = ref(false);
const saving = ref(false);
const suggestions = ref([]);
const selectedRows = ref([]);
const resultMessage = ref('');
const tableRef = ref(null);
const debugSummary = ref(null);
const debugText = ref('');

const allSelected = computed(() => suggestions.value.length > 0 && selectedRows.value.length === suggestions.value.length);

const fetchBaseData = async () => {
  try {
    const [rootRes, wordsRes] = await Promise.all([
      getRoot(rootId),
      getWords({ rootId }),
    ]);
    root.value = rootRes.data;
    wordCount.value = wordsRes.data.length;
  } catch {
    ElMessage.error('获取词根数据失败');
  }
};

const handleSelectionChange = (rows) => {
  selectedRows.value = rows;
};

const toggleAllSelection = () => {
  if (!tableRef.value) return;
  tableRef.value.toggleAllSelection();
};

const generateSuggestions = async () => {
  if (!ready.value) {
    return ElMessage.warning('请先完成 AI 配置');
  }

  loading.value = true;
  suggestions.value = [];
  selectedRows.value = [];
  resultMessage.value = '';
  debugSummary.value = null;
  debugText.value = '';

  try {
    const res = await getAiWordSuggestions(rootId, settings.value);
    suggestions.value = res.data.items || [];
    resultMessage.value = res.data.message || '建议生成完成';
    debugSummary.value = res.data.debug || null;
    debugText.value = JSON.stringify({
      ...res.data.debug,
      rootId,
      suggestedCount: res.data.items?.length || 0,
      hasMore: res.data.hasMore,
      message: res.data.message,
    }, null, 2);
  } catch (e) {
    resultMessage.value = '';
    debugText.value = JSON.stringify({
      rootId,
      message: e?.response?.data?.msg || e?.message || '生成单词建议失败',
      code: e?.code || '',
      status: e?.response?.status || '',
    }, null, 2);
    ElMessage.error(e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '生成单词建议失败'));
  } finally {
    loading.value = false;
  }
};

const handleSaveSelected = async () => {
  if (!selectedRows.value.length) {
    return ElMessage.warning('请先选择至少一个单词');
  }

  saving.value = true;
  try {
    const results = await Promise.allSettled(
      selectedRows.value.map((item) => createWord({
        rootId,
        name: item.name,
        meaning: item.meaning,
        phonetic: item.phonetic,
        remark: item.remark,
      }))
    );

    const successCount = results.filter((item) => item.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    suggestions.value = suggestions.value.filter(
      (item) => !selectedRows.value.some((selected) => selected.name === item.name)
    );
    selectedRows.value = [];
    wordCount.value += successCount;

    if (successCount) {
      ElMessage.success(`已保存 ${successCount} 个单词`);
    }
    if (failedCount) {
      ElMessage.warning(`${failedCount} 个单词保存失败，可能已存在`);
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