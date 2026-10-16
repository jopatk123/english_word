<template>
  <el-dialog
    :model-value="modelValue"
    title="读完了，感觉怎么样？"
    width="420px"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <p class="passage-finish-tip">
      按自评安排下次重读：吃力明天再读，一般和轻松按 1、3、7、15、30、60 天的间隔逐级推后。
    </p>
    <div class="passage-finish-options">
      <button
        v-for="option in PASSAGE_RATINGS"
        :key="option.value"
        type="button"
        class="passage-finish-option"
        :class="`is-${option.value}`"
        :disabled="saving"
        @click="$emit('rate', option.value)"
      >
        <strong>{{ option.label }}</strong>
        <span>{{ option.hint }}</span>
      </button>
    </div>
  </el-dialog>
</template>

<script setup>
  import { PASSAGE_RATINGS } from '../../constants/passage.js';

  defineProps({
    modelValue: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
  });

  defineEmits(['update:modelValue', 'rate']);
</script>
