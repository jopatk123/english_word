<template>
  <div class="flashcard-container">
    <div class="flashcard choice-card">
      <div class="card-front">
        <div class="card-head">
          <div class="card-head-text">
            <span class="card-word">{{ card.word.name }}</span>
            <span v-if="card.word.phonetic" class="card-phonetic">{{ card.word.phonetic }}</span>
          </div>
          <SpeakButton :text="card.word.name" />
        </div>
        <WordImage
          v-if="card.word.hasImage"
          :word-id="card.word.id || card.wordId"
          :has-image="true"
          :alt="`${card.word.name} 的记忆图片`"
          variant="study"
        />
      </div>

      <div class="choice-options">
        <div
          v-for="(opt, idx) in choiceOptions"
          :key="idx"
          class="choice-option"
          :class="{
            'choice-correct': choiceAnswered && opt.id === card.word.id,
            'choice-wrong': choiceAnswered && choiceSelected === idx && opt.id !== card.word.id,
          }"
          @click="!choiceAnswered && $emit('choose', idx)"
        >
          <span class="choice-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
          <span class="choice-text">{{ opt.meaning }}</span>
        </div>
      </div>

      <div v-if="choiceAnswered" class="choice-result-actions">
        <el-button type="primary" @click="$emit('next')" :loading="submitting">
          {{ isLast ? '完成' : '下一个' }}
        </el-button>
      </div>

      <div class="keyboard-hint">
        快捷键：<kbd>A</kbd>/<kbd>B</kbd>/<kbd>C</kbd>/<kbd>D</kbd> 或
        <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>/<kbd>4</kbd> 选择；答题后
        <kbd>Enter或空格</kbd> 下一题
      </div>
    </div>
  </div>
</template>

<script setup>
  import SpeakButton from '../SpeakButton.vue';
  import WordImage from '../WordImage.vue';

  defineProps({
    card: { type: Object, required: true },
    choiceOptions: { type: Array, required: true },
    choiceSelected: { type: Number, default: -1 },
    choiceAnswered: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    isLast: { type: Boolean, default: false },
  });

  defineEmits(['choose', 'next']);
</script>
