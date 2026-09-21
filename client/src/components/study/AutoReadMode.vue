<template>
  <div class="flashcard-container">
    <div class="flashcard auto-read-card">
      <div class="card-head">
        <div class="card-head-text">
          <span class="card-word">{{ card.word.name }}</span>
          <span v-if="card.word.phonetic" class="card-phonetic">{{ card.word.phonetic }}</span>
        </div>
      </div>
      <div class="card-meaning">{{ card.word.meaning || '暂无释义' }}</div>
      <WordImage
        v-if="card.word.hasImage"
        :word-id="card.word.id || card.wordId"
        :has-image="true"
        :alt="`${card.word.name} 的记忆图片`"
        variant="study"
      />

      <div v-if="card.word.examples && card.word.examples.length > 0" class="card-examples">
        <div v-for="ex in card.word.examples" :key="ex.id" class="card-example">
          <p class="example-en"><ClickableSentence :text="ex.sentence" /></p>
          <p class="example-zh">{{ ex.translation }}</p>
        </div>
      </div>

      <div v-else class="card-hint">当前单词暂无例句，将直接进入下一词</div>
    </div>
  </div>
</template>

<script setup>
  import ClickableSentence from '../ClickableSentence.vue';
  import WordImage from '../WordImage.vue';

  defineProps({
    card: { type: Object, required: true },
  });
</script>
