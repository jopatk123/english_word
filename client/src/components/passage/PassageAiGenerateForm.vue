<template>
  <div class="passage-ai-form">
    <el-alert
      v-if="!aiReady"
      type="warning"
      :closable="false"
      title="尚未完成 AI 配置，请先配置后再生成短文。"
      class="passage-ai-alert"
    >
      <el-button size="small" @click="$router.push('/ai/settings')">去配置 AI</el-button>
    </el-alert>

    <el-form label-position="top" class="passage-form" @submit.prevent>
      <el-form-item label="主题">
        <el-input
          v-model="options.topic"
          maxlength="60"
          placeholder="例如：周末去海边、学做饭；留空由 AI 自选"
        />
      </el-form-item>
      <div class="passage-ai-row">
        <el-form-item label="难度">
          <el-select v-model="options.level">
            <el-option v-for="level in PASSAGE_LEVELS" :key="level" :label="level" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item label="长度">
          <el-select v-model="options.length">
            <el-option
              v-for="option in PASSAGE_LENGTH_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
      </div>
      <el-checkbox v-model="options.useLearningWords">
        嵌入我正在学的单词（随机挑选最多 8 个）
      </el-checkbox>
      <div class="passage-form-actions">
        <el-button type="primary" :loading="generating" :disabled="!aiReady" @click="generate">
          {{ preview ? '重新生成' : '生成短文' }}
        </el-button>
      </div>
    </el-form>

    <section v-if="preview" class="passage-ai-preview">
      <el-input v-model="preview.title" maxlength="120" class="passage-ai-title" />
      <p class="passage-card-meta">
        {{ preview.level }} · {{ preview.wordCount }} 词 · {{ preview.sentences.length }} 句
      </p>
      <p v-if="preview.targetWords.length" class="passage-ai-words">
        目标单词：
        <span
          v-for="word in preview.targetWords"
          :key="word"
          :class="preview.usedWords.includes(word) ? 'is-used' : 'is-missing'"
          >{{ word }}</span
        >
        <small>（划线的词 AI 没有用上）</small>
      </p>
      <div
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        class="passage-ai-preview-paragraph"
      >
        <p v-for="sentence in paragraph" :key="sentence.orderIndex">
          <span class="passage-ai-en">{{ sentence.text }}</span>
          <span v-if="sentence.translation" class="passage-ai-zh">{{ sentence.translation }}</span>
        </p>
      </div>
      <div class="passage-form-actions">
        <el-button :loading="generating" @click="generate">不满意，重新生成</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存这篇</el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
  import { ElMessage } from 'element-plus';
  import { createPassage, generatePassage } from '../../api/index.js';
  import { PASSAGE_LENGTH_OPTIONS, PASSAGE_LEVELS } from '../../constants/passage.js';
  import {
    isAiSettingsReady,
    loadAiSettings,
    refreshAiSettings,
    subscribeAiSettingsChanges,
  } from '../../utils/aiSettings.js';
  import { groupSentencesByParagraph } from '../../utils/passageText.js';

  const emit = defineEmits(['saved']);

  const options = reactive({ topic: '', level: 'B1', length: 'medium', useLearningWords: false });
  const settings = ref(loadAiSettings());
  const aiReady = computed(() => isAiSettingsReady(settings.value));
  const preview = ref(null);
  const generating = ref(false);
  const saving = ref(false);
  let unsubscribe = () => {};

  const paragraphs = computed(() =>
    preview.value ? groupSentencesByParagraph(preview.value.sentences) : []
  );

  const generate = async () => {
    generating.value = true;
    try {
      const res = await generatePassage({ ...options }, settings.value);
      preview.value = res.data.passage;
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '生成失败，请重试');
    } finally {
      generating.value = false;
    }
  };

  const save = async () => {
    const draft = preview.value;
    if (!draft.title.trim()) return ElMessage.warning('请填写标题');
    saving.value = true;
    try {
      const res = await createPassage({
        title: draft.title,
        content: draft.content,
        level: draft.level,
        source: 'ai',
        topic: draft.topic,
        sentenceTranslations: draft.sentences.map(({ text, translation }) => ({
          text,
          translation,
        })),
      });
      emit('saved', res.data.id, res.msg);
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '保存失败');
    } finally {
      saving.value = false;
    }
  };

  onMounted(async () => {
    unsubscribe = subscribeAiSettingsChanges((next) => {
      settings.value = next || loadAiSettings();
    });
    settings.value = await refreshAiSettings();
  });

  onUnmounted(() => unsubscribe());
</script>
