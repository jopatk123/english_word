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

    <!-- ========== 单词分析结果 ========== -->
    <template v-if="searchMode === 'word' && wordResult">
      <!-- 单词已存在提示 -->
      <el-card v-if="wordResult.existingWord" class="ai-card" style="margin-top: 16px">
        <el-alert type="success" :closable="false" show-icon>
          <template #title>
            单词 <strong>{{ wordResult.existingWord.name }}</strong> 已存在于词根
            <el-link type="primary" @click="$router.push(`/root/${wordResult.existingWord.rootId}`)">
              {{ wordResult.existingWord.rootName }}
            </el-link> 下，
            <el-link type="primary" @click="$router.push(`/word/${wordResult.existingWord.id}`)">
              点击查看详情
            </el-link>
          </template>
        </el-alert>
      </el-card>

      <!-- AI 分析 -->
      <el-card class="ai-card" style="margin-top: 16px">
        <template #header>
          <div class="page-heading page-heading-between">
            <h2>AI 分析结果</h2>
          </div>
        </template>

        <!-- 单词基础信息 -->
        <div class="word-analysis-header">
          <div class="card-header">
            <span class="root-name">{{ wordResult.analysis.word }}</span>
            <SpeakButton :text="wordResult.analysis.word" />
            <span class="phonetic">{{ wordResult.analysis.phonetic }}</span>
          </div>
          <div class="root-meaning" style="margin-top: 8px">{{ wordResult.analysis.meaning }}</div>
        </div>

        <!-- 词根信息 -->
        <el-divider />
        <div v-if="wordResult.analysis.root" class="root-info-section">
          <h3 style="margin-bottom: 12px">词根信息</h3>
          <div class="cell-with-speak" style="margin-bottom: 8px">
            <el-tag type="primary" size="large">{{ wordResult.analysis.root.name }}</el-tag>
            <SpeakButton :text="wordResult.analysis.root.name" />
            <span style="margin-left: 8px; color: #606266">{{ wordResult.analysis.root.meaning }}</span>
          </div>

          <div v-if="wordResult.existingRoot" style="margin-top: 8px">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                词根 <strong>{{ wordResult.existingRoot.name }}</strong> 已存在，
                <el-link type="primary" @click="$router.push(`/root/${wordResult.existingRoot.id}`)">
                  点击查看
                </el-link>
              </template>
            </el-alert>
          </div>

          <div v-if="!wordResult.existingRoot && !wordResult.existingWord" style="margin-top: 8px">
            <el-checkbox v-model="addRoot" :disabled="addExamples">
              添加词根「{{ wordResult.analysis.root.name }}」到我的词根库
            </el-checkbox>
          </div>
        </div>
        <div v-else>
          <el-alert type="info" :closable="false" title="该单词没有明确的词根来源" show-icon />
        </div>

        <!-- 添加单词选项 -->
        <template v-if="!wordResult.existingWord && canAddWord">
          <el-divider />
          <div>
            <el-checkbox v-model="addWord" :disabled="addExamples">
              添加单词「{{ wordResult.analysis.word }}」
            </el-checkbox>
          </div>
        </template>

        <!-- 例句 -->
        <template v-if="wordResult.analysis.examples.length">
          <el-divider />
          <h3 style="margin-bottom: 12px">常用例句</h3>
          <div class="example-list">
            <el-card
              v-for="(ex, idx) in wordResult.analysis.examples"
              :key="idx"
              shadow="hover"
              class="example-card"
            >
              <div class="example-content">
                <div class="example-sentence">
                  <div class="cell-with-speak">
                    <span>{{ ex.sentence }}</span>
                    <SpeakButton :text="ex.sentence" />
                  </div>
                </div>
                <div class="example-translation">{{ ex.translation }}</div>
              </div>
              <div v-if="canAddExamples" class="example-actions">
                <el-checkbox
                  :model-value="selectedExamples.includes(idx)"
                  @change="(val) => toggleExample(idx, val)"
                >
                  添加例句
                </el-checkbox>
              </div>
            </el-card>
          </div>
        </template>

        <!-- 操作按钮 -->
        <div v-if="showSaveButton" class="page-actions ai-footer-actions">
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存选中内容
          </el-button>
          <span v-if="saveSummary" style="color: #909399; font-size: 13px; margin-left: 8px">
            {{ saveSummary }}
          </span>
        </div>
      </el-card>
    </template>

    <!-- ========== 句子分析结果 ========== -->
    <template v-if="searchMode === 'sentence' && sentenceResult">
      <el-card class="ai-card" style="margin-top: 16px">
        <template #header>
          <div class="page-heading page-heading-between">
            <h2>句子分析</h2>
          </div>
        </template>

        <!-- 原句 + 朗读 -->
        <div class="sentence-original">
          <div class="cell-with-speak">
            <span class="sentence-text">{{ sentenceResult.analysis.sentence }}</span>
            <SpeakButton :text="sentenceResult.analysis.sentence" />
          </div>
        </div>

        <!-- 翻译 -->
        <el-divider />
        <h3 style="margin-bottom: 8px">中文翻译</h3>
        <p class="sentence-translation">{{ sentenceResult.analysis.translation }}</p>

        <!-- 语法分析 -->
        <el-divider />
        <h3 style="margin-bottom: 8px">语法结构分析</h3>
        <p class="grammar-text">{{ sentenceResult.analysis.grammar }}</p>

        <!-- 关键词汇 -->
        <template v-if="sentenceResult.analysis.vocabulary.length">
          <el-divider />
          <h3 style="margin-bottom: 12px">关键词汇</h3>
          <el-table :data="sentenceResult.analysis.vocabulary" stripe>
            <el-table-column prop="word" label="单词" min-width="120">
              <template #default="{ row }">
                <div class="cell-with-speak">
                  <strong>{{ row.word }}</strong>
                  <SpeakButton :text="row.word" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="phonetic" label="音标" min-width="120" />
            <el-table-column prop="meaning" label="含义" min-width="150" />
          </el-table>
        </template>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { analyzeWord, analyzeSentence, createRoot, createWord, createExample } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';
import { getProviderById } from '../constants/aiProviders.js';
import { isAiSettingsReady, loadAiSettings } from '../utils/aiSettings.js';

const settings = ref(loadAiSettings());
const ready = computed(() => isAiSettingsReady(settings.value));
const providerName = computed(() => getProviderById(settings.value.providerId).name);

const searchInput = ref('');
const loading = ref(false);
const saving = ref(false);
const errorMsg = ref('');
const searchMode = ref(''); // 'word' | 'sentence'

// 单词分析
const wordResult = ref(null);
const addRoot = ref(false);
const addWord = ref(false);
const selectedExamples = ref([]);

// 句子分析
const sentenceResult = ref(null);

// 判断输入是单词还是句子
const isWord = (input) => /^[a-zA-Z-]+$/.test(input.trim());

// 能否添加单词（需要词根已存在或勾选添加词根）
const canAddWord = computed(() => {
  if (!wordResult.value) return false;
  // 有词根且（词根已存在 或 勾选添加词根）
  if (wordResult.value.analysis.root) {
    return wordResult.value.existingRoot || addRoot.value;
  }
  return false;
});

// 能否添加例句（需要单词可添加且勾选添加单词）
const canAddExamples = computed(() => {
  if (!wordResult.value || wordResult.value.existingWord) return false;
  return canAddWord.value && addWord.value;
});

// 是否显示保存按钮
const showSaveButton = computed(() => {
  if (!wordResult.value || wordResult.value.existingWord) return false;
  return addRoot.value || addWord.value || selectedExamples.value.length > 0;
});

// 保存摘要
const saveSummary = computed(() => {
  const parts = [];
  if (addRoot.value && !wordResult.value?.existingRoot) parts.push('词根');
  if (addWord.value) parts.push('单词');
  if (selectedExamples.value.length) parts.push(`${selectedExamples.value.length} 条例句`);
  return parts.length ? `将保存: ${parts.join('、')}` : '';
});

// 勾选/取消例句时自动勾选单词和词根
const toggleExample = (idx, checked) => {
  if (checked) {
    if (!selectedExamples.value.includes(idx)) {
      selectedExamples.value.push(idx);
    }
    // 添加例句必然添加单词和词根
    addWord.value = true;
    if (!wordResult.value?.existingRoot) {
      addRoot.value = true;
    }
  } else {
    selectedExamples.value = selectedExamples.value.filter((i) => i !== idx);
  }
};

const clearResults = () => {
  searchMode.value = '';
  wordResult.value = null;
  sentenceResult.value = null;
  addRoot.value = false;
  addWord.value = false;
  selectedExamples.value = [];
  errorMsg.value = '';
};

const handleSearch = async () => {
  const input = searchInput.value.trim();
  if (!input) {
    return ElMessage.warning('请输入要搜索的内容');
  }

  // 基本验证：需要包含英文字母
  if (!/[a-zA-Z]/.test(input)) {
    return ElMessage.warning('请输入英文单词或句子');
  }

  if (!ready.value) {
    return ElMessage.warning('请先完成 AI 配置');
  }

  clearResults();
  loading.value = true;
  errorMsg.value = '';

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

const handleSave = async () => {
  if (!wordResult.value) return;

  saving.value = true;
  try {
    let rootId = wordResult.value.existingRoot?.id || null;

    // 1. 添加词根
    if (addRoot.value && !wordResult.value.existingRoot) {
      const rootRes = await createRoot({
        name: wordResult.value.analysis.root.name,
        meaning: wordResult.value.analysis.root.meaning,
      });
      rootId = rootRes.data.id;
      ElMessage.success(`词根「${wordResult.value.analysis.root.name}」添加成功`);
    }

    // 2. 添加单词
    let wordId = null;
    if (addWord.value && rootId) {
      const wordRes = await createWord({
        rootId,
        name: wordResult.value.analysis.word,
        meaning: wordResult.value.analysis.meaning,
        phonetic: wordResult.value.analysis.phonetic,
      });
      wordId = wordRes.data.id;
      ElMessage.success(`单词「${wordResult.value.analysis.word}」添加成功`);
    }

    // 3. 添加例句
    if (selectedExamples.value.length && wordId) {
      const results = await Promise.allSettled(
        selectedExamples.value.map((idx) => {
          const ex = wordResult.value.analysis.examples[idx];
          return createExample({
            wordId,
            sentence: ex.sentence,
            translation: ex.translation,
          });
        })
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      if (successCount) {
        ElMessage.success(`${successCount} 条例句添加成功`);
      }
    }

    // 添加完成后更新状态
    if (rootId && addRoot.value && !wordResult.value.existingRoot) {
      wordResult.value.existingRoot = {
        id: rootId,
        name: wordResult.value.analysis.root.name,
        meaning: wordResult.value.analysis.root.meaning,
      };
      addRoot.value = false;
    }
    if (wordId && addWord.value) {
      wordResult.value.existingWord = {
        id: wordId,
        name: wordResult.value.analysis.word,
        rootId,
        rootName: wordResult.value.analysis.root?.name,
      };
      addWord.value = false;
      selectedExamples.value = [];
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '保存失败，请重试');
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.search-form {
  max-width: 600px;
}

.word-analysis-header {
  padding-bottom: 8px;
}

.sentence-original {
  padding: 12px 0;
}

.sentence-text {
  font-size: 18px;
  font-weight: 500;
  color: #303133;
  line-height: 1.6;
}

.sentence-translation {
  font-size: 16px;
  color: #606266;
  line-height: 1.6;
}

.grammar-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
}

.root-info-section h3 {
  font-size: 16px;
  color: #303133;
}

.example-card .el-card__body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
</style>
