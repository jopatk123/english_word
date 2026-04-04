<template>
  <div class="flashcard-container">
    <SessionProgress :currentIndex="currentIndex" :total="total" />

    <div class="flashcard" :class="{ flipped: showAnswer }" @click="!showAnswer && $emit('flip')">
      <div class="card-front">
        <div v-if="againCountMap[card.wordId] > 0" class="again-badge">
          第 {{ againCountMap[card.wordId] + 1 }} 次复习
        </div>
        <div class="card-word">{{ card.word.name }}</div>
        <div v-if="card.word.phonetic" class="card-phonetic">{{ card.word.phonetic }}</div>
        <SpeakButton :text="card.word.name" />
        <div class="card-root-tag">
          词根：{{
            (card.word.roots || []).map((r) => `${r.name}（${r.meaning}）`).join('、') || '无'
          }}
        </div>
        <div class="card-hint">点击卡片显示答案</div>
      </div>
      <div v-if="showAnswer" class="card-back">
        <div class="card-divider"></div>
        <div class="card-meaning">{{ card.word.meaning }}</div>
        <div v-if="card.word.remark" class="card-remark">{{ card.word.remark }}</div>
        <div v-if="card.word.examples && card.word.examples.length > 0" class="card-examples">
          <div v-for="ex in card.word.examples.slice(0, 2)" :key="ex.id" class="card-example">
            <p class="example-en">
              {{ ex.sentence }} <SpeakButton :text="ex.sentence" class="example-speak" />
            </p>
            <p class="example-zh">{{ ex.translation }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAnswer" class="rating-buttons">
      <el-button class="rate-btn rate-again" @click="$emit('rate', 1)" :loading="submitting"
        >再来一遍</el-button
      >
      <el-button class="rate-btn rate-hard" @click="$emit('rate', 2)" :loading="submitting"
        >有点难</el-button
      >
      <el-button class="rate-btn rate-good" @click="$emit('rate', 3)" :loading="submitting"
        >认识</el-button
      >
      <el-button class="rate-btn rate-easy" @click="$emit('rate', 4)" :loading="submitting"
        >很熟悉</el-button
      >
    </div>
    <div v-else class="flip-action">
      <el-button type="primary" size="large" @click="$emit('flip')">显示答案</el-button>
      <div class="keyboard-hint">
        快捷键：<kbd>空格</kbd> 翻牌，翻牌后 <kbd>空格</kbd> 发音，<kbd>1</kbd>-<kbd>4</kbd> 评分
      </div>
    </div>
  </div>
</template>

<script setup>
  import SpeakButton from '../SpeakButton.vue';
  import SessionProgress from './SessionProgress.vue';

  defineProps({
    card: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    total: { type: Number, required: true },
    showAnswer: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    againCountMap: { type: Object, default: () => ({}) },
  });

  defineEmits(['flip', 'rate']);
</script>
