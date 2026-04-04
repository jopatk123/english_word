<template>
  <div class="mode-select">
    <!-- 断点续学提示 -->
    <div v-if="resumeInfo" class="resume-banner">
      <el-alert type="info" :closable="false" show-icon>
        <template #default>
          检测到上次未完成记录（第 <strong>{{ resumeInfo.index + 1 }}</strong
          >/{{ queueLength }} 个，{{ modeNames[resumeInfo.mode] || resumeInfo.mode }} 模式）
          <el-button size="small" type="primary" style="margin-left: 12px" @click="$emit('resume')"
            >继续上次</el-button
          >
          <el-button size="small" style="margin-left: 6px" @click="$emit('dismiss')"
            >重新开始</el-button
          >
        </template>
      </el-alert>
    </div>
    <h2>选择学习模式</h2>
    <div class="mode-options">
      <div class="mode-card" @click="$emit('select', 'flashcard')">
        <div class="mode-icon">📇</div>
        <div class="mode-name">闪卡模式</div>
        <div class="mode-desc">翻牌查看释义，自评掌握程度</div>
      </div>
      <div class="mode-card" @click="$emit('select', 'choice')">
        <div class="mode-icon">📝</div>
        <div class="mode-name">选择题</div>
        <div class="mode-desc">看单词选释义，四选一</div>
      </div>
      <div class="mode-card" @click="$emit('select', 'spelling')">
        <div class="mode-icon">✏️</div>
        <div class="mode-name">拼写模式</div>
        <div class="mode-desc">看释义拼单词，练习拼写</div>
      </div>
      <div class="mode-card" @click="$emit('select', 'listening')">
        <div class="mode-icon">🎧</div>
        <div class="mode-name">听力模式</div>
        <div class="mode-desc">听发音拼单词，锻炼听力</div>
      </div>
    </div>
    <div class="mode-count">共 {{ queueLength }} 个单词待复习</div>
  </div>
</template>

<script setup>
  defineProps({
    queueLength: { type: Number, required: true },
    resumeInfo: { type: Object, default: null },
    modeNames: { type: Object, required: true },
  });

  defineEmits(['select', 'resume', 'dismiss']);
</script>
