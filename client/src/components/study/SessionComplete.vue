<template>
  <div class="session-complete">
    <div class="complete-icon">🎉</div>
    <h2>学习完成！</h2>
    <div class="complete-stats">
      <p>
        本次复习 <strong>{{ sessionStats.total }}</strong> 个单词
      </p>
      <div class="result-bars">
        <div class="result-item" v-if="sessionStats.again > 0">
          <span class="result-label result-again">再来一遍</span>
          <span class="result-count">{{ sessionStats.again }}</span>
        </div>
        <div class="result-item" v-if="sessionStats.hard > 0">
          <span class="result-label result-hard">有点难</span>
          <span class="result-count">{{ sessionStats.hard }}</span>
        </div>
        <div class="result-item" v-if="sessionStats.good > 0">
          <span class="result-label result-good">认识</span>
          <span class="result-count">{{ sessionStats.good }}</span>
        </div>
        <div class="result-item" v-if="sessionStats.easy > 0">
          <span class="result-label result-easy">很熟悉</span>
          <span class="result-count">{{ sessionStats.easy }}</span>
        </div>
      </div>
    </div>
    <div class="complete-actions">
      <el-button type="primary" @click="$router.push('/study')">返回仪表盘</el-button>
      <el-button @click="$emit('replay')">换模式再来一遍</el-button>
      <el-button v-if="hasAgainWords" type="warning" plain @click="$emit('replay-again')"
        >重练错误单词（{{ againWordCount }} 个）</el-button
      >
      <el-button @click="$router.push('/')">回到首页</el-button>
    </div>
  </div>
</template>

<script setup>
  defineProps({
    sessionStats: { type: Object, required: true },
    hasAgainWords: { type: Boolean, default: false },
    againWordCount: { type: Number, default: 0 },
  });

  defineEmits(['replay', 'replay-again']);
</script>
