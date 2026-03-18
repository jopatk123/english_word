<template>
  <el-card class="ai-card" style="margin-top: 16px">
    <template #header>
      <div class="page-heading page-heading-between">
        <h2>句子分析</h2>
      </div>
    </template>

    <!-- 原句 + 朗读 -->
    <div class="sentence-original">
      <div class="cell-with-speak">
        <span class="sentence-text">{{ result.analysis.sentence }}</span>
        <SpeakButton :text="result.analysis.sentence" />
      </div>
    </div>

    <!-- 翻译 -->
    <el-divider />
    <h3 style="margin-bottom: 8px">中文翻译</h3>
    <p class="sentence-translation">{{ result.analysis.translation }}</p>

    <!-- 语法分析 -->
    <el-divider />
    <h3 style="margin-bottom: 8px">语法结构分析</h3>
    <p class="grammar-text">{{ result.analysis.grammar }}</p>

    <!-- 关键词汇 -->
    <template v-if="result.analysis.vocabulary.length">
      <el-divider />
      <h3 style="margin-bottom: 12px">关键词汇</h3>
      <el-table :data="result.analysis.vocabulary" stripe>
        <el-table-column prop="word" label="单词" min-width="120">
          <template #default="{ row }">
            <div class="cell-with-speak">
              <strong>{{ row.word }}</strong>
              <SpeakButton :text="row.word" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phonetic" label="音标" min-width="120" />
        <el-table-column prop="meaning" label="含义" min-width="150" />
      </el-table>
    </template>
  </el-card>
</template>

<script setup>
import SpeakButton from '../SpeakButton.vue';

defineProps({
  result: { type: Object, required: true },
});
</script>

<style scoped>
.sentence-original {
  padding: 12px 0;
}

.sentence-text {
  font-size: 18px;
  font-weight: 500;
  color: #303133;
  line-height: 1.6;
}

.sentence-translation {
  font-size: 16px;
  color: #606266;
  line-height: 1.6;
}

.grammar-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
