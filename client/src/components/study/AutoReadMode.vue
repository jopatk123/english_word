<template>
  <div class="flashcard-container">
    <SessionProgress :currentIndex="currentIndex" :total="total" @seek="$emit('seek', $event)" />

    <div class="flashcard">
      <div class="card-word">{{ card.word.name }}</div>
      <div v-if="card.word.phonetic" class="card-phonetic">{{ card.word.phonetic }}</div>
      <div class="card-hint">自动朗读中：单词会读 2 次，例句会读 1 次后进入下一词</div>

      <div v-if="card.word.examples && card.word.examples.length > 0" class="card-examples">
        <div v-for="ex in card.word.examples" :key="ex.id" class="card-example">
          <p class="example-en">{{ ex.sentence }}</p>
          <p class="example-zh">{{ ex.translation }}</p>
        </div>
      </div>

      <div v-else class="card-hint" style="margin-top: 24px">
        当前单词暂无例句，将直接进入下一词
      </div>
    </div>
  </div>
</template>

<script setup>
  import SessionProgress from './SessionProgress.vue';

  defineProps({
    card: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    total: { type: Number, required: true },
  });

  defineEmits(['seek']);
</script>