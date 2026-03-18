<template>
  <!-- 单词已存在提示 -->
  <el-card v-if="wordResult.existingWord" class="ai-card" style="margin-top: 16px">
    <el-alert type="success" :closable="false" show-icon>
      <template #title>
        单词 <strong>{{ wordResult.existingWord.name }}</strong> 已存在，关联词根：
        <template v-for="(root, idx) in (wordResult.existingWord.roots || [])" :key="root.id">
          <el-link type="primary" @click="$router.push(`/root/${root.id}`)">{{ root.name }}</el-link>
          <span v-if="idx < wordResult.existingWord.roots.length - 1">、</span>
        </template>
        ，
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

    <!-- 词性分析 -->
    <template v-if="wordResult.analysis.partOfSpeech?.length">
      <el-divider />
      <h3 style="margin-bottom: 12px">词性分析</h3>
      <div class="pos-list">
        <div v-for="(pos, idx) in wordResult.analysis.partOfSpeech" :key="idx" class="pos-item">
          <el-tag type="warning" size="small" class="pos-tag">{{ pos.type }}</el-tag>
          <span class="pos-meaning">{{ pos.meaning }}</span>
        </div>
      </div>
    </template>

    <!-- 词根信息 -->
    <el-divider />
    <div v-if="wordResult.analysis.roots?.length" class="root-info-section">
      <h3 style="margin-bottom: 12px">词根信息（{{ wordResult.analysis.roots.length }} 个）</h3>
      <div v-for="(analysisRoot, rIdx) in wordResult.analysis.roots" :key="rIdx" style="margin-bottom: 12px; padding: 8px 0; border-bottom: 1px dashed #ebeef5">
        <div class="cell-with-speak" style="margin-bottom: 8px">
          <el-tag type="primary" size="large">{{ analysisRoot.name }}</el-tag>
          <SpeakButton :text="analysisRoot.name" />
          <span style="margin-left: 8px; color: #606266">{{ analysisRoot.meaning }}</span>
        </div>

        <div v-if="isRootExisting(analysisRoot.name)" style="margin-top: 8px">
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              词根 <strong>{{ analysisRoot.name }}</strong> 已存在，
              <el-link type="primary" @click="$router.push(`/root/${getExistingRootId(analysisRoot.name)}`)">
                点击查看
              </el-link>
            </template>
          </el-alert>
        </div>

        <div v-if="!isRootExisting(analysisRoot.name) && !wordResult.existingWord" style="margin-top: 8px">
          <el-checkbox
            :model-value="addRoots.includes(rIdx)"
            @change="(val) => toggleAddRoot(rIdx, val)"
          >
            添加词根「{{ analysisRoot.name }}」到我的词根库
          </el-checkbox>
        </div>
      </div>
    </div>
    <div v-else>
      <el-alert type="info" :closable="false" show-icon>
        <template #title>
          该单词没有明确的词根来源，保存后将归入
          <strong>「未分类」</strong>词根分组
        </template>
      </el-alert>
    </div>

    <!-- 添加单词选项 -->
    <template v-if="!wordResult.existingWord && canAddWord">
      <el-divider />
      <div>
        <el-checkbox v-model="addWord" :disabled="addExamples">
          添加单词「{{ wordResult.analysis.word }}」
          <el-tag
            v-if="!wordResult.analysis.roots?.length"
            type="info"
            size="small"
            style="margin-left: 6px; vertical-align: middle"
          >→ 未分类</el-tag>
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

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { createRoot, createWord, createExample } from '../../api/index.js';
import SpeakButton from '../SpeakButton.vue';

const props = defineProps({
  wordResult: { type: Object, required: true },
});

const saving = ref(false);
const addRoots = ref([]);
const addWord = ref(false);
const selectedExamples = ref([]);

const isRootExisting = (name) => {
  return props.wordResult?.existingRoots?.some((r) => r.name === name) || false;
};

const getExistingRootId = (name) => {
  return props.wordResult?.existingRoots?.find((r) => r.name === name)?.id;
};

const toggleAddRoot = (idx, val) => {
  if (val) {
    if (!addRoots.value.includes(idx)) addRoots.value.push(idx);
  } else {
    addRoots.value = addRoots.value.filter((i) => i !== idx);
  }
};

const canAddWord = computed(() => {
  const roots = props.wordResult.analysis.roots;
  if (roots?.length) {
    const hasExisting = roots.some((r) => isRootExisting(r.name));
    return hasExisting || addRoots.value.length > 0;
  }
  return true;
});

const addExamples = computed(() => selectedExamples.value.length > 0);

const canAddExamples = computed(() => {
  if (props.wordResult.existingWord) return false;
  return canAddWord.value && addWord.value;
});

const showSaveButton = computed(() => {
  if (props.wordResult.existingWord) return false;
  return addRoots.value.length > 0 || addWord.value || selectedExamples.value.length > 0;
});

const saveSummary = computed(() => {
  const parts = [];
  const newRootCount = addRoots.value.filter((idx) => {
    const r = props.wordResult?.analysis.roots?.[idx];
    return r && !isRootExisting(r.name);
  }).length;
  if (newRootCount) parts.push(`${newRootCount} 个词根`);
  if (addWord.value) {
    const noRoot = !props.wordResult?.analysis.roots?.length;
    parts.push(noRoot ? '单词（→未分类）' : '单词');
  }
  if (selectedExamples.value.length) parts.push(`${selectedExamples.value.length} 条例句`);
  return parts.length ? `将保存: ${parts.join('、')}` : '';
});

const toggleExample = (idx, checked) => {
  if (checked) {
    if (!selectedExamples.value.includes(idx)) {
      selectedExamples.value.push(idx);
    }
    addWord.value = true;
    const roots = props.wordResult?.analysis.roots || [];
    roots.forEach((r, rIdx) => {
      if (!isRootExisting(r.name) && !addRoots.value.includes(rIdx)) {
        addRoots.value.push(rIdx);
      }
    });
  } else {
    selectedExamples.value = selectedExamples.value.filter((i) => i !== idx);
  }
};

const formatMeaning = (analysis) => {
  if (analysis.partOfSpeech?.length) {
    return analysis.partOfSpeech.map((p) => `${p.type} ${p.meaning}`).join('  ');
  }
  return analysis.meaning;
};

const handleSave = async () => {
  saving.value = true;
  try {
    const analysisRoots = props.wordResult.analysis.roots || [];
    const rootIds = [];

    for (const r of analysisRoots) {
      const existingId = getExistingRootId(r.name);
      if (existingId) rootIds.push(existingId);
    }

    const createdRootNames = [];
    for (const idx of addRoots.value) {
      const r = analysisRoots[idx];
      if (!r || isRootExisting(r.name)) continue;
      const rootRes = await createRoot({ name: r.name, meaning: r.meaning });
      rootIds.push(rootRes.data.id);
      createdRootNames.push(r.name);
      if (!props.wordResult.existingRoots) props.wordResult.existingRoots = [];
      props.wordResult.existingRoots.push({ id: rootRes.data.id, name: r.name, meaning: r.meaning });
    }
    if (createdRootNames.length) {
      ElMessage.success(`词根「${createdRootNames.join('、')}」添加成功`);
    }
    addRoots.value = [];

    let wordId = null;
    if (addWord.value) {
      const wordData = {
        name: props.wordResult.analysis.word,
        meaning: formatMeaning(props.wordResult.analysis),
        phonetic: props.wordResult.analysis.phonetic,
      };
      if (rootIds.length) wordData.rootIds = rootIds;
      const wordRes = await createWord(wordData);
      wordId = wordRes.data.id;
      ElMessage.success(`单词「${props.wordResult.analysis.word}」添加成功`);
    }

    if (selectedExamples.value.length && wordId) {
      const results = await Promise.allSettled(
        selectedExamples.value.map((idx) => {
          const ex = props.wordResult.analysis.examples[idx];
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

    if (wordId && addWord.value) {
      props.wordResult.existingWord = {
        id: wordId,
        name: props.wordResult.analysis.word,
        roots: (props.wordResult.existingRoots || []).map((r) => r.name),
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
.word-analysis-header {
  padding-bottom: 8px;
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

.pos-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pos-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pos-tag {
  flex-shrink: 0;
  font-style: italic;
  font-weight: 600;
  min-width: 42px;
  text-align: center;
}

.pos-meaning {
  color: #303133;
  font-size: 14px;
  line-height: 1.5;
}
</style>
