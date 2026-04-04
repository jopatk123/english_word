<template>
  <!-- 单词已存在提示 -->
  <el-card v-if="localExistingWord" class="ai-card" style="margin-top: 16px">
    <el-alert type="success" :closable="false" show-icon>
      <template #title>
        单词 <strong>{{ localExistingWord.name }}</strong> 已存在，关联词根：
        <span v-for="(root, idx) in localExistingWord.roots || []" :key="root.id">
          <el-link type="primary" @click="$router.push(`/root/${root.id}`)">{{
            root.name
          }}</el-link>
          <span v-if="idx < localExistingWord.roots.length - 1">、</span>
        </span>
        ，
        <el-link type="primary" @click="$router.push(`/word/${localExistingWord.id}`)">
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
      <div
        v-for="(analysisRoot, rIdx) in wordResult.analysis.roots"
        :key="rIdx"
        style="margin-bottom: 12px; padding: 8px 0; border-bottom: 1px dashed #ebeef5"
      >
        <div class="cell-with-speak" style="margin-bottom: 8px">
          <el-tag type="primary" size="large">{{ analysisRoot.name }}</el-tag>
          <SpeakButton :text="analysisRoot.name" />
          <span style="margin-left: 8px; color: #606266">{{ analysisRoot.meaning }}</span>
        </div>

        <div v-if="isRootExisting(analysisRoot.name)" style="margin-top: 8px">
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              词根 <strong>{{ analysisRoot.name }}</strong> 已存在，
              <el-link
                type="primary"
                @click="$router.push(`/root/${getExistingRootId(analysisRoot.name)}`)"
              >
                点击查看
              </el-link>
            </template>
          </el-alert>
          <div v-if="!localExistingWord" style="margin-top: 4px">
            <el-checkbox
              :model-value="isExistingRootIncluded(analysisRoot.name)"
              @change="(val) => toggleIncludeExistingRoot(analysisRoot.name, val)"
            >
              将单词关联到此词根「{{ analysisRoot.name }}」
            </el-checkbox>
          </div>
        </div>

        <div
          v-if="!isRootExisting(analysisRoot.name) && !localExistingWord"
          style="margin-top: 8px"
        >
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

    <!-- 手动指定词根 -->
    <template v-if="!localExistingWord">
      <el-divider />
      <div>
        <div style="font-size: 13px; color: #606266; margin-bottom: 8px">
          手动指定词根（可选，若不选择任何词根则自动归入「未分类」）：
        </div>
        <el-select
          v-model="manualRootIds"
          multiple
          filterable
          remote
          reserve-keyword
          placeholder="输入词根名称搜索..."
          :remote-method="searchRoots"
          :loading="rootSearchLoading"
          style="width: 100%; max-width: 480px"
        >
          <el-option
            v-for="opt in rootOptions"
            :key="opt.id"
            :label="`${opt.name} — ${opt.meaning}`"
            :value="opt.id"
          />
        </el-select>
      </div>
    </template>

    <!-- 添加单词选项 -->
    <template v-if="!localExistingWord">
      <el-divider />
      <div>
        <el-checkbox v-model="addWord" :disabled="addExamples">
          添加单词「{{ wordResult.analysis.word }}」
          <el-tag
            v-if="willGoToUncategorized"
            type="info"
            size="small"
            style="margin-left: 6px; vertical-align: middle"
            >→ 未分类</el-tag
          >
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
          <div class="example-actions">
            <el-button
              type="primary"
              text
              size="small"
              :loading="regeneratingExampleIndex === idx"
              @click="emit('regenerate-example', { index: idx })"
            >
              重新生成
            </el-button>
            <el-checkbox
              v-if="canAddExamples"
              :model-value="selectedExamples.includes(idx)"
              @change="(val) => toggleExample(idx, val)"
            >
              添加例句
            </el-checkbox>
          </div>
        </el-card>
      </div>
    </template>

    <!-- 操作按钮（存在 localExistingWord 时隐藏，canAddAll 内部已判断）-->
    <div v-if="canAddAll" class="page-actions ai-footer-actions">
      <el-button type="primary" :loading="saving" @click="handleAddAll"> 一键添加全部 </el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!showSaveButton"
        style="margin-left: 8px"
        @click="handleSave"
      >
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
  import { createRoot, createWord, createExample, getRoots } from '../../api/index.js';
  import SpeakButton from '../SpeakButton.vue';

  const props = defineProps({
    wordResult: { type: Object, required: true },
    regeneratingExampleIndex: { type: Number, default: -1 },
  });

  const emit = defineEmits(['regenerate-example']);

  const saving = ref(false);
  const addRoots = ref([]);
  const addWord = ref(false);
  const selectedExamples = ref([]);
  const excludedExistingRootNames = ref([]);
  const manualRootIds = ref([]);
  const rootSearchLoading = ref(false);
  const rootOptions = ref([]);

  // 本地可变副本，避免直接变异 prop
  const localExistingWord = ref(props.wordResult?.existingWord ?? null);
  const localExistingRoots = ref([...(props.wordResult?.existingRoots ?? [])]);

  const isRootExisting = (name) => {
    return localExistingRoots.value.some((r) => r.name === name);
  };

  const getExistingRootId = (name) => {
    return localExistingRoots.value.find((r) => r.name === name)?.id;
  };

  const isExistingRootIncluded = (name) => !excludedExistingRootNames.value.includes(name);

  const toggleIncludeExistingRoot = (name, val) => {
    if (val) {
      excludedExistingRootNames.value = excludedExistingRootNames.value.filter((n) => n !== name);
    } else {
      if (!excludedExistingRootNames.value.includes(name)) {
        excludedExistingRootNames.value.push(name);
      }
    }
  };

  const searchRoots = async (query) => {
    if (!query) {
      rootOptions.value = [];
      return;
    }
    rootSearchLoading.value = true;
    try {
      const res = await getRoots(query);
      rootOptions.value = res.data || [];
    } catch {
      rootOptions.value = [];
    } finally {
      rootSearchLoading.value = false;
    }
  };

  const toggleAddRoot = (idx, val) => {
    if (val) {
      if (!addRoots.value.includes(idx)) addRoots.value.push(idx);
    } else {
      addRoots.value = addRoots.value.filter((i) => i !== idx);
    }
  };

  const canAddWord = computed(() => !localExistingWord.value);

  const willGoToUncategorized = computed(() => {
    if (!addWord.value) return false;
    const roots = props.wordResult.analysis.roots || [];
    const hasExistingIncluded = roots.some(
      (r) => isRootExisting(r.name) && isExistingRootIncluded(r.name)
    );
    return !hasExistingIncluded && addRoots.value.length === 0 && manualRootIds.value.length === 0;
  });

  const addExamples = computed(() => selectedExamples.value.length > 0);

  const canAddExamples = computed(() => {
    if (localExistingWord.value) return false;
    return addWord.value;
  });

  const showSaveButton = computed(() => {
    if (localExistingWord.value) return false;
    return addRoots.value.length > 0 || addWord.value || selectedExamples.value.length > 0;
  });

  const canAddAll = computed(() => {
    // 一键添加功能在当前单词尚未存在时可用
    return !localExistingWord.value;
  });

  const handleAddAll = () => {
    if (saving.value) return;

    // 取消所有对已存在词根的排除（确保全部包含）
    excludedExistingRootNames.value = [];

    // 选择所有可添加的词根（仅勾选，不提交）
    const allRootIndexes = (props.wordResult.analysis.roots || [])
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !isRootExisting(r.name))
      .map(({ idx }) => idx);

    addRoots.value = Array.from(new Set([...(addRoots.value || []), ...allRootIndexes]));

    // 确保单词被勾选
    addWord.value = true;

    // 选择所有例句（如果有）
    selectedExamples.value = (props.wordResult.analysis.examples || []).map((_, idx) => idx);
  };

  const saveSummary = computed(() => {
    const parts = [];
    const newRootCount = addRoots.value.filter((idx) => {
      const r = props.wordResult.analysis.roots?.[idx];
      return r && !isRootExisting(r.name);
    }).length;
    if (newRootCount) parts.push(`${newRootCount} 个词根`);
    if (addWord.value) {
      parts.push(willGoToUncategorized.value ? '单词（→未分类）' : '单词');
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
    const goToUncategorized = willGoToUncategorized.value;
    try {
      const analysisRoots = props.wordResult.analysis.roots || [];
      const rootIds = [...manualRootIds.value];

      for (const r of analysisRoots) {
        const existingId = getExistingRootId(r.name);
        if (existingId && isExistingRootIncluded(r.name)) rootIds.push(existingId);
      }

      const createdRootNames = [];
      for (const idx of addRoots.value) {
        const r = analysisRoots[idx];
        if (!r || isRootExisting(r.name)) continue;
        const rootRes = await createRoot({ name: r.name, meaning: r.meaning });
        rootIds.push(rootRes.data.id);
        createdRootNames.push(r.name);
        localExistingRoots.value.push({
          id: rootRes.data.id,
          name: r.name,
          meaning: r.meaning,
        });
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
        if (rootIds.length) wordData.rootIds = [...new Set(rootIds)];
        const wordRes = await createWord(wordData);
        wordId = wordRes.data.id;
        const dest = goToUncategorized ? '（已归入「未分类」）' : '';
        ElMessage.success(`单词「${props.wordResult.analysis.word}」${dest}添加成功`);
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
        localExistingWord.value = {
          id: wordId,
          name: props.wordResult.analysis.word,
          roots: localExistingRoots.value.map((r) => r.name),
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

  .example-actions {
    display: flex;
    align-items: center;
    gap: 12px;
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
