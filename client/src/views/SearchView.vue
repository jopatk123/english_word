<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>搜索</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 搜索框 -->
    <el-card class="ai-card">
      <template #header>
        <div class="page-heading">
          <div>
            <h2>🔍 搜索单词 / 句子</h2>
            <p>输入英文单词或句子，AI 将为你分析并辅助学习。</p>
          </div>
        </div>
      </template>

      <el-form @submit.prevent="handleSearch" class="search-form">
        <el-input
          v-model="searchInput"
          placeholder="输入英文单词或句子..."
          size="large"
          clearable
          @clear="clearResults"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button :loading="loading" @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </el-form>

      <el-alert
        v-if="!ready"
        type="warning"
        :closable="false"
        title="尚未完成 AI 配置，请先前往 AI 配置页面设置后再使用搜索功能。"
        show-icon
        style="margin-top: 16px"
      />

      <div v-if="ready" class="config-strip" style="margin-top: 12px">
        <el-tag type="success">{{ providerName }}</el-tag>
        <span>模型：{{ settings.model }}</span>
      </div>
    </el-card>

    <!-- 错误提示 -->
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      closable
      style="margin-top: 16px"
      @close="errorMsg = ''"
    />

    <!-- 单词分析结果 -->
    <WordAnalysisResult
      v-if="searchMode === 'word' && wordResult"
      :wordResult="wordResult"
      :regenerating-example-index="regeneratingExampleIndex"
      @regenerate-example="handleRegenerateExample"
    />

    <!-- 句子分析结果 -->
    <SentenceAnalysisResult v-if="searchMode === 'sentence' && sentenceResult" :result="sentenceResult" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { analyzeWord, analyzeSentence } from '../api/index.js';
import { getProviderById } from '../constants/aiProviders.js';
import { isAiSettingsReady, loadAiSettings } from '../utils/aiSettings.js';
import WordAnalysisResult from '../components/search/WordAnalysisResult.vue';
import SentenceAnalysisResult from '../components/search/SentenceAnalysisResult.vue';

const settings = ref(loadAiSettings());
const ready = computed(() => isAiSettingsReady(settings.value));
const providerName = computed(() => getProviderById(settings.value.providerId).name);

const searchInput = ref('');
const loading = ref(false);
const errorMsg = ref('');
const searchMode = ref('');
const wordResult = ref(null);
const sentenceResult = ref(null);
const regeneratingExampleIndex = ref(-1);

const isWord = (input) => /^[a-zA-Z-]+$/.test(input.trim());

const clearResults = () => {
  searchMode.value = '';
  wordResult.value = null;
  sentenceResult.value = null;
  errorMsg.value = '';
  regeneratingExampleIndex.value = -1;
};

const handleRegenerateExample = async ({ index }) => {
  if (index < 0 || !wordResult.value?.analysis?.examples?.length) return;
  if (!ready.value) {
    return ElMessage.warning('请先完成 AI 配置');
  }

  const analysis = wordResult.value.analysis;
  const excludedSentences = analysis.examples
    .map((item) => item?.sentence)
    .filter(Boolean);

  regeneratingExampleIndex.value = index;
  try {
    const res = await analyzeWord(analysis.word, settings.value, {
      excludedSentences,
      singleExample: true,
    });
    const newExample = res.data?.analysis?.examples?.[0];
    if (!newExample) {
      return ElMessage.warning('没有生成新的例句，请再试一次');
    }

    const nextExamples = [...analysis.examples];
    nextExamples[index] = newExample;
    analysis.examples = nextExamples;
    ElMessage.success('已重新生成该例句');
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '重新生成例句失败'));
  } finally {
    regeneratingExampleIndex.value = -1;
  }
};

const handleSearch = async () => {
  const input = searchInput.value.trim();
  if (!input) {
    return ElMessage.warning('请输入要搜索的内容');
  }

  if (!/[a-zA-Z]/.test(input)) {
    return ElMessage.warning('请输入英文单词或句子');
  }

  if (!ready.value) {
    return ElMessage.warning('请先完成 AI 配置');
  }

  clearResults();
  loading.value = true;

  try {
    if (isWord(input)) {
      searchMode.value = 'word';
      const res = await analyzeWord(input, settings.value);
      wordResult.value = res.data;
    } else {
      searchMode.value = 'sentence';
      const res = await analyzeSentence(input, settings.value);
      sentenceResult.value = res.data;
    }
  } catch (e) {
    errorMsg.value = e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : '搜索分析失败，请重试');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.search-form {
  max-width: 600px;
}
</style>
