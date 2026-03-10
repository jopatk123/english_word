<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>智能添加词根</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="ai-card">
      <template #header>
        <div class="page-heading page-heading-between">
          <div>
            <h2>智能添加词根</h2>
            <p>AI 会分析当前已有词根，推荐尚未收录的高频常用词根。</p>
          </div>
          <div class="page-actions">
            <el-button @click="$router.push('/ai/settings')">修改配置</el-button>
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
          <span>Base URL：{{ settings.baseUrl }}</span>
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
          <el-table-column prop="name" label="词根" min-width="120">
            <template #default="{ row }">
              <div class="cell-with-speak">
                <span>{{ row.name }}</span>
                <SpeakButton :text="row.name" />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="meaning" label="核心含义" min-width="150" />
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column prop="reason" label="推荐理由" min-width="180" show-overflow-tooltip />
        </el-table>

        <div v-if="suggestions.length" class="page-actions ai-footer-actions">
          <el-button @click="toggleAllSelection">{{ allSelected ? '取消全选' : '全选建议' }}</el-button>
          <el-button type="primary" :loading="saving" @click="handleSaveSelected">保存选中词根</el-button>
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
import { ElMessage } from 'element-plus';
import { createRoot, getAiRootSuggestions } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';
import { getProviderById } from '../constants/aiProviders.js';
import { isAiSettingsReady, loadAiSettings } from '../utils/aiSettings.js';

const settings = ref(loadAiSettings());
const ready = computed(() => isAiSettingsReady(settings.value));
const providerName = computed(() => getProviderById(settings.value.providerId).name);

const loading = ref(false);
const saving = ref(false);
const suggestions = ref([]);
const selectedRows = ref([]);
const resultMessage = ref('');
const tableRef = ref(null);
const debugSummary = ref(null);
const debugText = ref('');

const allSelected = computed(() => suggestions.value.length > 0 && selectedRows.value.length === suggestions.value.length);

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
    const res = await getAiRootSuggestions(settings.value);
    suggestions.value = res.data.items || [];
    resultMessage.value = res.data.message || '建议生成完成';
    debugSummary.value = res.data.debug || null;
    debugText.value = JSON.stringify({
      ...res.data.debug,
      suggestedCount: res.data.items?.length || 0,
      hasMore: res.data.hasMore,
      message: res.data.message,
    }, null, 2);
  } catch (e) {
    resultMessage.value = '';
    debugText.value = JSON.stringify({
      message: e?.response?.data?.msg || e?.message || '生成词根建议失败',
      code: e?.code || '',
      status: e?.response?.status || '',
    }, null, 2);
    ElMessage.error(e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '生成词根建议失败'));
  } finally {
    loading.value = false;
  }
};

const handleSaveSelected = async () => {
  if (!selectedRows.value.length) {
    return ElMessage.warning('请先选择至少一个词根');
  }

  saving.value = true;
  try {
    const results = await Promise.allSettled(
      selectedRows.value.map((item) => createRoot({
        name: item.name,
        meaning: item.meaning,
        remark: item.remark,
      }))
    );

    const successCount = results.filter((item) => item.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    suggestions.value = suggestions.value.filter(
      (item) => !selectedRows.value.some((selected) => selected.name === item.name)
    );
    selectedRows.value = [];

    if (successCount) {
      ElMessage.success(`已保存 ${successCount} 个词根`);
    }
    if (failedCount) {
      ElMessage.warning(`${failedCount} 个词根保存失败，可能已存在`);
    }
    if (!suggestions.value.length) {
      resultMessage.value = '当前这批建议已处理完成，如需更多建议可以再次生成';
    }
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  if (ready.value) {
    generateSuggestions();
  }
});
</script>