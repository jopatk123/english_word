<template>
  <div class="flashcard-container">
    <SessionProgress :currentIndex="currentIndex" :total="total" @seek="$emit('seek', $event)" />

    <div class="flashcard spelling-card">
      <!-- 拼写模式：显示释义 -->
      <template v-if="mode === 'spelling'">
        <div class="card-meaning" style="font-size: 22px; margin-bottom: 16px">
          {{ card.word.meaning }}
        </div>
        <div v-if="card.word.roots?.length" class="card-root-tag">
          词根：{{ card.word.roots.map((r) => `${r.name}（${r.meaning}）`).join('、') }}
        </div>
      </template>

      <!-- 听力模式：播放按钮 + 文字提示 -->
      <template v-else>
        <div style="font-size: 18px; color: #909399; margin-bottom: 16px">听发音，拼写单词</div>
        <SpeakButton :text="card.word.name" size="large" />
        <div v-if="spellingHintLevel > 0 && !answered" class="listening-hint">
          提示：{{ spellingHint }}
        </div>
      </template>

      <div class="spelling-input-area" :style="mode === 'listening' ? 'margin-top: 20px;' : ''">
        <div class="spelling-input-row">
          <el-input
            v-model="localInput"
            :placeholder="mode === 'spelling' ? spellingHint : '输入你听到的单词...'"
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
            <div
              v-if="mode === 'listening'"
              style="color: #909399; font-size: 14px; margin-top: 4px"
            >
              {{ card.word.meaning }}
            </div>
          </div>
          <div v-else class="spelling-wrong">
            ❌ 正确答案：<strong>{{ card.word.name }}</strong>
            <div
              v-if="mode === 'listening'"
              style="color: #909399; font-size: 14px; margin-top: 4px"
            >
              {{ card.word.meaning }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="!answered" class="spelling-actions">
        <el-button type="primary" @click="$emit('check')" :disabled="!localInput.trim()"
          >确认</el-button
        >
      </div>
      <div v-else class="spelling-actions">
        <el-button type="primary" @click="$emit('next')" :loading="submitting">
          {{ isLast ? '完成' : '下一个' }}
        </el-button>
      </div>

      <div v-if="mode === 'spelling'" class="keyboard-hint">
        快捷键：<kbd>Enter</kbd> 确认/下一个
      </div>
      <div v-else-if="mode === 'listening'" class="keyboard-hint">
        快捷键：<kbd>空格</kbd> 重播发音；<kbd>Enter</kbd> 确认/下一个
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch, nextTick } from 'vue';
  import SpeakButton from '../SpeakButton.vue';
  import SessionProgress from './SessionProgress.vue';

  const props = defineProps({
    card: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    total: { type: Number, required: true },
    mode: { type: String, required: true },
    inputValue: { type: String, default: '' },
    answered: { type: Boolean, default: false },
    correct: { type: Boolean, default: false },
    hard: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    spellingHint: { type: String, default: '输入单词拼写...' },
    spellingHintLevel: { type: Number, default: 0 },
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
