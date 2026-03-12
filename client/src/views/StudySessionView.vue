<template>
  <div class="study-session">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习中</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 加载状态 -->
    <div v-if="loading" class="session-loading" v-loading="true" element-loading-text="加载学习队列..." />

    <!-- 学习完成 -->
    <div v-else-if="finished" class="session-complete">
      <div class="complete-icon">🎉</div>
      <h2>学习完成！</h2>
      <div class="complete-stats">
        <p>本次复习 <strong>{{ sessionStats.total }}</strong> 个单词</p>
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
        <el-button @click="$router.push('/')">回到首页</el-button>
      </div>
    </div>

    <!-- 闪卡界面 -->
    <div v-else-if="currentCard" class="flashcard-container">
      <!-- 进度条 -->
      <div class="session-progress">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <el-progress
          :percentage="Math.round((currentIndex / queue.length) * 100)"
          :show-text="false"
          :stroke-width="6"
        />
      </div>

      <!-- 闪卡 -->
      <div class="flashcard" :class="{ flipped: showAnswer }" @click="!showAnswer && flipCard()">
        <!-- 正面：单词 -->
        <div class="card-front">
          <div class="card-word">{{ currentCard.word.name }}</div>
          <div v-if="currentCard.word.phonetic" class="card-phonetic">{{ currentCard.word.phonetic }}</div>
          <SpeakButton :text="currentCard.word.name" />
          <div class="card-root-tag">
            词根：{{ currentCard.word.root?.name }}（{{ currentCard.word.root?.meaning }}）
          </div>
          <div class="card-hint">点击卡片显示答案</div>
        </div>

        <!-- 背面：释义 + 例句 -->
        <div v-if="showAnswer" class="card-back">
          <div class="card-divider"></div>
          <div class="card-meaning">{{ currentCard.word.meaning }}</div>
          <div v-if="currentCard.word.remark" class="card-remark">
            {{ currentCard.word.remark }}
          </div>
          <div v-if="currentCard.word.examples && currentCard.word.examples.length > 0" class="card-examples">
            <div
              v-for="ex in currentCard.word.examples.slice(0, 2)"
              :key="ex.id"
              class="card-example"
            >
              <p class="example-en">
                {{ ex.sentence }}
                <SpeakButton :text="ex.sentence" class="example-speak" />
              </p>
              <p class="example-zh">{{ ex.translation }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 评分按钮（翻转后显示） -->
      <div v-if="showAnswer" class="rating-buttons">
        <el-button
          class="rate-btn rate-again"
          @click="submitRating(1)"
          :loading="submitting"
        >
          再来一遍
        </el-button>
        <el-button
          class="rate-btn rate-hard"
          @click="submitRating(2)"
          :loading="submitting"
        >
          有点难
        </el-button>
        <el-button
          class="rate-btn rate-good"
          @click="submitRating(3)"
          :loading="submitting"
        >
          认识
        </el-button>
        <el-button
          class="rate-btn rate-easy"
          @click="submitRating(4)"
          :loading="submitting"
        >
          很熟悉
        </el-button>
      </div>

      <!-- 翻转按钮 -->
      <div v-else class="flip-action">
        <el-button type="primary" size="large" @click="flipCard">显示答案</el-button>
      </div>
    </div>

    <!-- 无待复习 -->
    <div v-else class="session-empty">
      <p>暂无待复习的单词</p>
      <el-button type="primary" @click="$router.push('/study')">返回仪表盘</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';

const loading = ref(true);
const queue = ref([]);
const currentIndex = ref(0);
const showAnswer = ref(false);
const submitting = ref(false);
const finished = ref(false);
const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });

const currentCard = computed(() => {
  if (currentIndex.value < queue.value.length) {
    return queue.value[currentIndex.value];
  }
  return null;
});

const fetchDue = async () => {
  loading.value = true;
  try {
    const res = await getReviewDue();
    queue.value = res.data || [];
    if (queue.value.length === 0) {
      finished.value = false;
    }
  } catch {
    ElMessage.error('获取复习队列失败');
  } finally {
    loading.value = false;
  }
};

const flipCard = () => {
  showAnswer.value = true;
};

const submitRating = async (quality) => {
  if (submitting.value) return;
  submitting.value = true;

  const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

  try {
    await submitReviewResult(currentCard.value.wordId, quality);
    sessionStats.value.total++;
    sessionStats.value[qualityMap[quality]]++;

    // 如果选了 again，把此卡片加到队尾再复习一次
    if (quality === 1) {
      queue.value.push({ ...currentCard.value });
    }

    currentIndex.value++;
    showAnswer.value = false;

    if (currentIndex.value >= queue.value.length) {
      finished.value = true;
    }
  } catch {
    ElMessage.error('提交复习结果失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => fetchDue());
</script>
