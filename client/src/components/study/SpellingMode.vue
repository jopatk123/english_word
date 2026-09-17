<template>
  <div class="flashcard-container">
    <SessionProgress :currentIndex="currentIndex" :total="total" @seek="$emit('seek', $event)" />

    <div class="flashcard spelling-card">
      <!-- 显示释义和词根供用户拼写 -->
      <div class="card-meaning" style="font-size: 22px; margin-bottom: 16px">
        {{ card.word.meaning }}
      </div>
      <div v-if="card.word.roots?.length" class="card-root-tag">
        词根：{{ card.word.roots.map((r) => `${r.name}（${r.meaning}）`).join('、') }}
      </div>
      <WordImage
        v-if="card.word.hasImage"
        :word-id="card.word.id || card.wordId"
        :has-image="true"
        :alt="`${card.word.name} 的记忆图片`"
        variant="study"
      />

      <div class="spelling-input-area">
        <div class="spelling-input-row">
          <el-input
            v-model="localInput"
            :placeholder="spellingHint"
            size="large"
            :disabled="answered"
            ref="inputRef"
          />
          <el-button v-if="!answered" class="spelling-hint-button" @click="$emit('hint')">
            提示
          </el-button>
        </div>
        <div v-if="answered" class="spelling-feedback">
          <div v-if="correct" class="spelling-correct">✅ 正确！</div>
          <div v-else-if="hard" class="spelling-hard">
            🟡 接近正确！正确答案：<strong>{{ card.word.name }}</strong>
          </div>
          <div v-else class="spelling-wrong">
            ❌ 正确答案：<strong>{{ card.word.name }}</strong>
          </div>
        </div>
      </div>

      <div v-if="!answered" class="spelling-actions">
        <el-button type="primary" @click="$emit('check')" :disabled="!localInput.trim()">
          确认
        </el-button>
      </div>
      <div v-else class="spelling-actions">
        <el-button type="primary" @click="$emit('next')" :loading="submitting">
          {{ isLast ? '完成' : '下一个' }}
        </el-button>
      </div>

      <div class="keyboard-hint">快捷键：<kbd>Enter</kbd> 确认/下一个</div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch, nextTick } from 'vue';
  import SessionProgress from './SessionProgress.vue';
  import WordImage from '../WordImage.vue';

  const props = defineProps({
    card: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    total: { type: Number, required: true },
    inputValue: { type: String, default: '' },
    answered: { type: Boolean, default: false },
    correct: { type: Boolean, default: false },
    hard: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    /** 渐进式提示文本（由 useSpellingMode.spellingHint 提供） */
    spellingHint: { type: String, default: '输入单词拼写...' },
    isLast: { type: Boolean, default: false },
  });

  const emit = defineEmits(['check', 'hint', 'next', 'seek', 'update:inputValue']);

  const localInput = computed({
    get: () => props.inputValue,
    set: (val) => emit('update:inputValue', val),
  });

  const inputRef = ref(null);

  const focus = () => {
    nextTick(() => inputRef.value?.focus());
  };

  onMounted(focus);
  watch(() => props.currentIndex, focus);

  defineExpose({ focus });
</script>
