<template>
  <div class="passage-page passage-reader" :class="{ 'is-listening': listening }">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/reading' }">短文阅读</el-breadcrumb-item>
      <el-breadcrumb-item>{{ passage?.title || '短文' }}</el-breadcrumb-item>
    </el-breadcrumb>

    <div v-if="loading" v-loading="true" class="passage-reader-loading" />

    <template v-else-if="passage">
      <header class="passage-reader-header">
        <h2>{{ passage.title }}</h2>
        <div class="passage-card-title">
          <el-tag v-if="passage.level" size="small" effect="plain">{{ passage.level }}</el-tag>
          <el-tag v-if="passage.source === 'ai'" size="small" type="info">AI</el-tag>
          <el-tag size="small" :type="status.tagType">{{ status.label }}</el-tag>
          <span class="passage-card-meta">
            {{ passage.wordCount }} 词 · {{ passage.sentenceCount }} 句
            <template v-if="passage.review">
              · 已读 {{ passage.review.readCount }} 次 · 下次重读 {{ passage.review.dueDate }}
            </template>
          </span>
        </div>
        <div class="passage-reader-actions">
          <el-button type="primary" @click="toggleListening">
            {{ listening ? '退出听读' : '▶ 听读' }}
          </el-button>
          <el-button @click="toggleAllTranslations">
            {{ showAllTranslations ? '隐藏译文' : '显示译文' }}
          </el-button>
          <el-button v-if="missingCount > 0" :loading="translating" @click="handleTranslate">
            AI 补全译文（{{ missingCount }} 句）
          </el-button>
          <el-button @click="$router.push(`/reading/${passage.id}/edit`)">编辑</el-button>
          <el-button type="success" plain @click="finishDialogVisible = true">读完了</el-button>
        </div>
      </header>

      <el-alert
        v-if="misaligned"
        type="info"
        show-icon
        :closable="false"
        class="passage-reader-alert"
        title="译文没能逐句对齐，已整段放在第一句。可以逐句修改，或清空后用 AI 补全。"
      />

      <p class="passage-reader-legend">
        点任意单词查释义；<span class="is-vocab-learning">黄色</span>
        是词库里还在学的词。每句末尾的「译」显示译文，「▶」从这句开始朗读。
      </p>

      <PassageText
        :passage-id="passage.id"
        :sentences="passage.sentences"
        :show-all-translations="showAllTranslations"
        :revealed-ids="revealedIds"
        :active-sentence-id="playback.currentSentence.value?.id ?? null"
        :word-class="vocab.wordClass"
        :word-added-handler="onWordAdded"
        @toggle-translation="toggleTranslation"
        @play-from="playFrom"
        @edit-translation="editTranslation"
      />

      <PassagePlayerBar
        v-if="listening"
        :playing="playback.playing.value"
        :loop="playback.loop.value"
        :rate="playback.rate.value"
        :current-index="playback.currentIndex.value"
        :total="passage.sentences.length"
        @toggle="playback.toggle"
        @prev="playback.prev"
        @next="playback.next"
        @toggle-loop="playback.toggleLoop"
        @update-rate="playback.setRate"
        @close="toggleListening"
      />
    </template>

    <PassageFinishDialog
      v-model="finishDialogVisible"
      :saving="rating"
      @rate="handleRate"
    />
  </div>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import PassageText from '../components/passage/PassageText.vue';
  import PassagePlayerBar from '../components/passage/PassagePlayerBar.vue';
  import PassageFinishDialog from '../components/passage/PassageFinishDialog.vue';
  import { usePassagePlayback } from '../composables/usePassagePlayback.js';
  import { useVocabHighlight } from '../composables/useVocabHighlight.js';
  import {
    getPassage,
    recordPassageRead,
    translatePassage,
    updatePassageSentence,
  } from '../api/index.js';
  import { PASSAGE_STATUS_MAP } from '../constants/passage.js';
  import { isAiSettingsReady, refreshAiSettings } from '../utils/aiSettings.js';
  import { countMissingTranslations, isTranslationMisaligned } from '../utils/passageText.js';

  const props = defineProps({
    id: { type: [String, Number], required: true },
  });

  const router = useRouter();
  const passage = ref(null);
  const loading = ref(false);
  const translating = ref(false);
  const rating = ref(false);
  const listening = ref(false);
  const finishDialogVisible = ref(false);
  const showAllTranslations = ref(false);
  // 单句覆盖全局开关：true 强制显示，false 强制隐藏
  const revealedIds = ref({});

  const sentences = computed(() => passage.value?.sentences || []);
  const status = computed(
    () => PASSAGE_STATUS_MAP[passage.value?.status] || PASSAGE_STATUS_MAP.unread
  );
  const missingCount = computed(() => countMissingTranslations(sentences.value));
  const misaligned = computed(() => isTranslationMisaligned(sentences.value));

  const vocab = useVocabHighlight(sentences);
  const playback = usePassagePlayback(sentences, {
    onFinished: () => {
      finishDialogVisible.value = true;
    },
  });

  const loadPassage = async () => {
    loading.value = true;
    try {
      const res = await getPassage(props.id);
      passage.value = res.data;
      revealedIds.value = {};
      vocab.load();
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '获取短文失败');
      router.replace('/reading');
    } finally {
      loading.value = false;
    }
  };

  const toggleListening = () => {
    if (listening.value) {
      playback.stop();
      listening.value = false;
      return;
    }
    listening.value = true;
    playback.play(0);
  };

  const playFrom = (index) => {
    listening.value = true;
    playback.play(index);
  };

  const toggleAllTranslations = () => {
    showAllTranslations.value = !showAllTranslations.value;
    revealedIds.value = {};
  };

  const toggleTranslation = (sentenceId) => {
    const current = revealedIds.value[sentenceId];
    const visible = showAllTranslations.value ? current !== false : current === true;
    revealedIds.value = { ...revealedIds.value, [sentenceId]: !visible };
  };

  const replaceSentence = (updated) => {
    passage.value.sentences = passage.value.sentences.map((sentence) =>
      sentence.id === updated.id ? { ...sentence, ...updated } : sentence
    );
  };

  const editTranslation = async (sentence) => {
    let value;
    try {
      ({ value } = await ElMessageBox.prompt(sentence.text, '修改译文', {
        inputValue: sentence.translation || '',
        inputType: 'textarea',
        inputPlaceholder: '留空则清除译文',
        confirmButtonText: '保存',
        cancelButtonText: '取消',
      }));
    } catch {
      return;
    }
    try {
      const res = await updatePassageSentence(passage.value.id, sentence.id, value || '');
      replaceSentence(res.data);
      ElMessage.success('译文已保存');
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '保存失败');
    }
  };

  const handleTranslate = async () => {
    const settings = await refreshAiSettings();
    if (!isAiSettingsReady(settings)) {
      ElMessage.warning('请先完成 AI 配置');
      router.push('/ai/settings');
      return;
    }
    translating.value = true;
    try {
      const res = await translatePassage(passage.value.id, settings);
      passage.value.sentences = res.data.sentences;
      if (res.data.missingCount) ElMessage.warning(res.msg);
      else ElMessage.success(res.msg);
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '翻译失败，请重试');
    } finally {
      translating.value = false;
    }
  };

  const handleRate = async (value) => {
    rating.value = true;
    try {
      const res = await recordPassageRead(passage.value.id, value);
      passage.value.review = res.data.review;
      passage.value.status = res.data.status;
      finishDialogVisible.value = false;
      ElMessage.success(`已记录，下次重读：${res.data.review.dueDate}`);
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '记录失败');
    } finally {
      rating.value = false;
    }
  };

  const onWordAdded = (saved) => vocab.markAdded(saved?.word);

  watch(
    () => props.id,
    () => {
      playback.stop();
      listening.value = false;
      loadPassage();
    }
  );

  onMounted(loadPassage);
</script>
