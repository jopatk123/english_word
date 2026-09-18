<template>
  <div class="flashcard-container">
    <div class="flashcard spelling-card">
      <div class="listening-toolbar">
        <SpeakButton :text="card.word.name" />
        <template v-if="sentenceExamples.length > 0">
          <el-button class="listening-audio-button" @click="playSentenceAudio">
            {{ sentenceButtonLabel }}
          </el-button>
          <el-button
            v-if="sentenceExamples.length > 1"
            class="listening-audio-button listening-audio-button-secondary"
            @click="cycleSentenceAudio"
          >
            换一句
          </el-button>
        </template>
        <span v-else class="listening-audio-empty">暂无例句音频</span>
      </div>
      <div v-if="revealedSentenceTranslation" class="listening-audio-translation">
        {{ revealedSentenceTranslation }}
      </div>

      <WordImage
        v-if="answered && card.word.hasImage"
        :word-id="card.word.id || card.wordId"
        :has-image="true"
        :alt="`${card.word.name} 的记忆图片`"
        variant="study"
      />

      <!-- 渐进式字母提示（仅在点击提示后显示） -->
      <div v-if="hintLevel > 0 && !answered" class="listening-hint">提示：{{ hint }}</div>

      <div class="spelling-input-area">
        <div class="spelling-input-row">
          <el-input
            v-model="localInput"
            placeholder="输入你听到的单词..."
            size="large"
            :disabled="answered"
            ref="inputRef"
          >
            <template v-if="!answered" #append>
              <el-button class="spelling-hint-button" @click="$emit('hint')">提示</el-button>
            </template>
          </el-input>
        </div>

        <div v-if="answered" class="spelling-feedback">
          <div v-if="correct" class="spelling-correct">✅ 正确！</div>
          <div v-else-if="hard" class="spelling-hard">
            🟡 接近正确！正确答案：<strong>{{ card.word.name }}</strong>
            <div class="word-meaning-reveal">{{ card.word.meaning }}</div>
          </div>
          <div v-else class="spelling-wrong">
            ❌ 正确答案：<strong>{{ card.word.name }}</strong>
            <div class="word-meaning-reveal">{{ card.word.meaning }}</div>
          </div>
        </div>
      </div>

      <div class="spelling-actions">
        <el-button
          v-if="!answered"
          type="primary"
          @click="$emit('check')"
          :disabled="!localInput.trim()"
        >
          确认
        </el-button>
        <el-button v-else type="primary" @click="$emit('next')" :loading="submitting">
          {{ isLast ? '完成' : '下一个' }}
        </el-button>
      </div>

      <div class="keyboard-hint">
        快捷键：<kbd>空格</kbd> 重播发音；<kbd>Enter</kbd> 确认/下一个
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch, nextTick } from 'vue';
  import SpeakButton from '../SpeakButton.vue';
  import WordImage from '../WordImage.vue';
  import { useSpeech } from '../../utils/speech.js';

  const props = defineProps({
    card: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    inputValue: { type: String, default: '' },
    answered: { type: Boolean, default: false },
    correct: { type: Boolean, default: false },
    hard: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    /** 渐进式提示文本（由 useSpellingMode.spellingHint 提供） */
    hint: { type: String, default: '' },
    /** 当前已显示的提示级别（0 = 未显示） */
    hintLevel: { type: Number, default: 0 },
    isLast: { type: Boolean, default: false },
  });

  const emit = defineEmits(['check', 'hint', 'next', 'update:inputValue']);

  const { speak } = useSpeech();

  const localInput = computed({
    get: () => props.inputValue,
    set: (val) => emit('update:inputValue', val),
  });

  const inputRef = ref(null);
  const sentenceIndex = ref(0);
  const revealedSentenceTranslation = ref('');

  const sentenceExamples = computed(() =>
    (props.card?.word?.examples || [])
      .map((example) => ({
        sentence: example?.sentence?.trim() || '',
        translation: example?.translation?.trim() || '',
      }))
      .filter((example) => example.sentence)
  );

  const currentSentence = computed(() => sentenceExamples.value[sentenceIndex.value] || null);
  const currentSentenceLabel = computed(() => {
    if (sentenceExamples.value.length <= 1) return '';
    return `${sentenceIndex.value + 1}/${sentenceExamples.value.length}`;
  });
  const sentenceButtonLabel = computed(() =>
    currentSentenceLabel.value ? `播放例句 ${currentSentenceLabel.value}` : '播放例句'
  );

  const playSentenceAudio = () => {
    if (!currentSentence.value) return;
    revealedSentenceTranslation.value = currentSentence.value.translation;
    speak(currentSentence.value.sentence);
  };

  const cycleSentenceAudio = () => {
    if (sentenceExamples.value.length <= 1) return;
    sentenceIndex.value = (sentenceIndex.value + 1) % sentenceExamples.value.length;
    playSentenceAudio();
  };

  const focus = () => {
    nextTick(() => inputRef.value?.focus());
  };

  onMounted(focus);
  watch(() => props.currentIndex, focus);
  watch(
    () => props.card?.wordId,
    () => {
      sentenceIndex.value = 0;
      revealedSentenceTranslation.value = '';
    }
  );

  defineExpose({ focus });
</script>
