<template>
  <div class="study-session">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习中</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 加载状态 -->
    <div v-if="loading" class="session-loading" v-loading="true" element-loading-text="加载学习队列..." />

    <!-- 模式选择（学习开始前） -->
    <div v-else-if="!modeSelected && queue.length > 0" class="mode-select">
      <!-- 断点续学提示 -->
      <div v-if="resumeInfo" class="resume-banner">
        <el-alert type="info" :closable="false" show-icon>
          <template #default>
            检测到上次未完成记录（第 <strong>{{ resumeInfo.index + 1 }}</strong>/{{ queue.length }} 个，{{ modeNames[resumeInfo.mode] || resumeInfo.mode }} 模式）
            <el-button size="small" type="primary" style="margin-left: 12px" @click="applyResume">继续上次</el-button>
            <el-button size="small" style="margin-left: 6px" @click="dismissResume">重新开始</el-button>
          </template>
        </el-alert>
      </div>
      <h2>选择学习模式</h2>
      <div class="mode-options">
        <div class="mode-card" @click="selectMode('flashcard')">
          <div class="mode-icon">📇</div>
          <div class="mode-name">闪卡模式</div>
          <div class="mode-desc">翻牌查看释义，自评掌握程度</div>
        </div>
        <div class="mode-card" @click="selectMode('choice')">
          <div class="mode-icon">📝</div>
          <div class="mode-name">选择题</div>
          <div class="mode-desc">看单词选释义，四选一</div>
        </div>
        <div class="mode-card" @click="selectMode('spelling')">
          <div class="mode-icon">✏️</div>
          <div class="mode-name">拼写模式</div>
          <div class="mode-desc">看释义拼单词，练习拼写</div>
        </div>
        <div class="mode-card" @click="selectMode('listening')">
          <div class="mode-icon">🎧</div>
          <div class="mode-name">听力模式</div>
          <div class="mode-desc">听发音拼单词，锻炼听力</div>
        </div>
      </div>
      <div class="mode-count">共 {{ queue.length }} 个单词待复习</div>
    </div>

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
        <el-button @click="replayWithNewMode">换模式再来一遍</el-button>
        <el-button v-if="hasAgainWords" type="warning" plain @click="replayAgainWords">重练错误单词（{{ againWordCount }} 个）</el-button>
        <el-button @click="$router.push('/')">回到首页</el-button>
      </div>
    </div>

    <!-- 闪卡模式 -->
    <div v-else-if="currentCard && studyMode === 'flashcard'" class="flashcard-container">
      <div class="session-progress">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <el-progress :percentage="Math.round((currentIndex / queue.length) * 100)" :show-text="false" :stroke-width="6" />
      </div>

      <div class="flashcard" :class="{ flipped: showAnswer }" @click="!showAnswer && flipCard()">
        <div class="card-front">
          <div v-if="againCountMap[currentCard.wordId] > 0" class="again-badge">
            第 {{ againCountMap[currentCard.wordId] + 1 }} 次复习
          </div>
          <div class="card-word">{{ currentCard.word.name }}</div>
          <div v-if="currentCard.word.phonetic" class="card-phonetic">{{ currentCard.word.phonetic }}</div>
          <SpeakButton :text="currentCard.word.name" />
          <div class="card-root-tag">
            词根：{{ currentCard.word.root?.name }}（{{ currentCard.word.root?.meaning }}）
          </div>
          <div class="card-hint">点击卡片显示答案</div>
        </div>
        <div v-if="showAnswer" class="card-back">
          <div class="card-divider"></div>
          <div class="card-meaning">{{ currentCard.word.meaning }}</div>
          <div v-if="currentCard.word.remark" class="card-remark">{{ currentCard.word.remark }}</div>
          <div v-if="currentCard.word.examples && currentCard.word.examples.length > 0" class="card-examples">
            <div v-for="ex in currentCard.word.examples.slice(0, 2)" :key="ex.id" class="card-example">
              <p class="example-en">{{ ex.sentence }} <SpeakButton :text="ex.sentence" class="example-speak" /></p>
              <p class="example-zh">{{ ex.translation }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showAnswer" class="rating-buttons">
        <el-button class="rate-btn rate-again" @click="submitRating(1)" :loading="submitting">再来一遍</el-button>
        <el-button class="rate-btn rate-hard" @click="submitRating(2)" :loading="submitting">有点难</el-button>
        <el-button class="rate-btn rate-good" @click="submitRating(3)" :loading="submitting">认识</el-button>
        <el-button class="rate-btn rate-easy" @click="submitRating(4)" :loading="submitting">很熟悉</el-button>
      </div>
      <div v-else class="flip-action">
        <el-button type="primary" size="large" @click="flipCard">显示答案</el-button>
        <div class="keyboard-hint">快捷键：<kbd>空格</kbd> 翻牌，翻牌后按 <kbd>1</kbd>-<kbd>4</kbd> 评分</div>
      </div>
    </div>

    <!-- 选择题模式 -->
    <div v-else-if="currentCard && studyMode === 'choice'" class="flashcard-container">
      <div class="session-progress">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <el-progress :percentage="Math.round((currentIndex / queue.length) * 100)" :show-text="false" :stroke-width="6" />
      </div>

      <div class="flashcard choice-card">
        <div class="card-front">
          <div class="card-word">{{ currentCard.word.name }}</div>
          <div v-if="currentCard.word.phonetic" class="card-phonetic">{{ currentCard.word.phonetic }}</div>
          <SpeakButton :text="currentCard.word.name" />
        </div>

        <div class="choice-options">
          <div
            v-for="(opt, idx) in choiceOptions"
            :key="idx"
            class="choice-option"
            :class="{
              'choice-correct': choiceAnswered && opt.id === currentCard.word.id,
              'choice-wrong': choiceAnswered && choiceSelected === idx && opt.id !== currentCard.word.id,
            }"
            @click="!choiceAnswered && handleChoice(idx)"
          >
            <span class="choice-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
            <span class="choice-text">{{ opt.meaning }}</span>
          </div>
        </div>

        <div v-if="choiceAnswered" class="choice-result-actions">
          <el-button type="primary" @click="choiceNext" :loading="submitting">
            {{ currentIndex + 1 >= queue.length ? '完成' : '下一个' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 拼写模式 -->
    <div v-else-if="currentCard && studyMode === 'spelling'" class="flashcard-container">
      <div class="session-progress">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <el-progress :percentage="Math.round((currentIndex / queue.length) * 100)" :show-text="false" :stroke-width="6" />
      </div>

      <div class="flashcard spelling-card">
        <div class="card-meaning" style="font-size: 22px; margin-bottom: 16px;">{{ currentCard.word.meaning }}</div>
        <div v-if="currentCard.word.root" class="card-root-tag">
          词根：{{ currentCard.word.root?.name }}（{{ currentCard.word.root?.meaning }}）
        </div>

        <div class="spelling-input-area">
          <el-input
            v-model="spellingInput"
            :placeholder="spellingHint"
            size="large"
            :disabled="spellingAnswered"
            @keyup.enter="checkSpelling"
            ref="spellingInputRef"
          />
          <div v-if="spellingAnswered" class="spelling-feedback">
            <div v-if="spellingCorrect" class="spelling-correct">✅ 正确！</div>
            <div v-else class="spelling-wrong">
              ❌ 正确答案：<strong>{{ currentCard.word.name }}</strong>
            </div>
          </div>
        </div>

        <div v-if="!spellingAnswered" class="spelling-actions">
          <el-button type="primary" @click="checkSpelling" :disabled="!spellingInput.trim()">确认</el-button>
          <el-button @click="showSpellingHint">提示</el-button>
        </div>
        <div v-else class="spelling-actions">
          <el-button type="primary" @click="spellingNext" :loading="submitting">
            {{ currentIndex + 1 >= queue.length ? '完成' : '下一个' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 听力模式 -->
    <div v-else-if="currentCard && studyMode === 'listening'" class="flashcard-container">
      <div class="session-progress">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <el-progress :percentage="Math.round((currentIndex / queue.length) * 100)" :show-text="false" :stroke-width="6" />
      </div>

      <div class="flashcard spelling-card">
        <div style="font-size: 18px; color: #909399; margin-bottom: 16px;">听发音，拼写单词</div>
        <SpeakButton :text="currentCard.word.name" size="large" />

        <div class="spelling-input-area" style="margin-top: 20px;">
          <el-input
            v-model="spellingInput"
            placeholder="输入你听到的单词..."
            size="large"
            :disabled="spellingAnswered"
            @keyup.enter="checkSpelling"
            ref="listeningInputRef"
          />
          <div v-if="spellingAnswered" class="spelling-feedback">
            <div v-if="spellingCorrect" class="spelling-correct">✅ 正确！</div>
            <div v-else class="spelling-wrong">
              ❌ 正确答案：<strong>{{ currentCard.word.name }}</strong>
              <div style="color: #909399; font-size: 14px; margin-top: 4px;">{{ currentCard.word.meaning }}</div>
            </div>
          </div>
        </div>

        <div v-if="!spellingAnswered" class="spelling-actions">
          <el-button type="primary" @click="checkSpelling" :disabled="!spellingInput.trim()">确认</el-button>
        </div>
        <div v-else class="spelling-actions">
          <el-button type="primary" @click="spellingNext" :loading="submitting">
            {{ currentIndex + 1 >= queue.length ? '完成' : '下一个' }}
          </el-button>
        </div>
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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewDue, submitReviewResult, getQuizChoices } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';
import { useSpeech } from '../utils/speech.js';

const route = useRoute();

const loading = ref(true);
const queue = ref([]);
const originalQueue = ref([]); // 保存初始队列，供重播功能使用
const currentIndex = ref(0);
const showAnswer = ref(false);
const submitting = ref(false);
const finished = ref(false);
const sessionStats = ref({ total: 0, again: 0, hard: 0, good: 0, easy: 0 });
const MAX_AGAIN_PER_WORD = 3;
const againCountMap = ref({});
const resumeInfo = ref(null); // 断点续学信息

// 学习模式
const studyMode = ref('flashcard'); // flashcard | choice | spelling | listening
const modeSelected = ref(false);
const modeNames = { flashcard: '闪卡', choice: '选择题', spelling: '拼写', listening: '听力' };

// 选择题状态
const choiceOptions = ref([]);
const choiceSelected = ref(-1);
const choiceAnswered = ref(false);

// 拼写 & 听力模式状态
const spellingInput = ref('');
const spellingAnswered = ref(false);
const spellingCorrect = ref(false);
const spellingHintLevel = ref(0);
const spellingInputRef = ref(null);
const listeningInputRef = ref(null);

const { speak } = useSpeech();

const spellingHint = computed(() => {
  if (!currentCard.value) return '输入单词...';
  const name = currentCard.value.word.name;
  if (spellingHintLevel.value === 0) return '输入单词拼写...';
  if (spellingHintLevel.value === 1) return `${name[0]}${'_'.repeat(name.length - 1)} (${name.length}个字母)`;
  return `${name.slice(0, Math.ceil(name.length / 2))}${'_'.repeat(name.length - Math.ceil(name.length / 2))}`;
});

const currentCard = computed(() => {
  if (currentIndex.value < queue.value.length) {
    return queue.value[currentIndex.value];
  }
  return null;
});

// 自动朗读：进入卡片时朗读一次，翻牌时再朗读一次
watch(
  [currentCard, studyMode, modeSelected],
  ([card, mode, selected], previousValues = []) => {
    const [prevCard, prevMode, prevSelected] = previousValues;

    if (!card) return;
    if (mode !== 'flashcard' || !selected) return;

    const isNewCard = card !== prevCard;
    const justEnteredFlashcard = mode === 'flashcard' && prevMode !== 'flashcard';
    const justStarted = selected && !prevSelected;

    if (isNewCard || justEnteredFlashcard || justStarted) {
      nextTick(() => {
        speak(card.word.name);
      });
    }
  },
  { immediate: true }
);

const againWordIds = computed(() => Object.keys(againCountMap.value).map(Number));
const hasAgainWords = computed(() => againWordIds.value.length > 0);
const againWordCount = computed(() => againWordIds.value.length);

const selectMode = (mode) => {
  studyMode.value = mode;
  modeSelected.value = true;
  // 保存模式到 localStorage 以便下次记住
  localStorage.setItem('study-mode', mode);
  if (mode === 'choice') loadChoices();
  if (mode === 'spelling' || mode === 'listening') {
    nextTick(() => {
      (spellingInputRef.value || listeningInputRef.value)?.focus();
    });
  }
};

const fetchDue = async () => {
  loading.value = true;
  try {
    const saved = localStorage.getItem('study-session-progress');
    const advanceDays = Math.min(parseInt(route.query.advance) || 0, 30);
    const res = await getReviewDue(advanceDays > 0 ? { advance: advanceDays } : {});
    queue.value = res.data || [];
    originalQueue.value = [...queue.value]; // 保存初始队列

    if (saved && queue.value.length > 0) {
      try {
        const progress = JSON.parse(saved);
        if (progress.queueIds && queue.value.length > 0) {
          const currentIds = queue.value.map(r => r.wordId).join(',');
          if (progress.queueIds === currentIds && progress.index > 0 && progress.index < queue.value.length) {
            resumeInfo.value = progress; // 待用户选择是否续学
          }
        }
      } catch { /* ignore corrupt data */ }
    }

    if (queue.value.length === 0) {
      finished.value = false;
    }
  } catch {
    ElMessage.error('获取复习队列失败');
  } finally {
    loading.value = false;
  }
};

// 断点续学操作
const applyResume = () => {
  const progress = resumeInfo.value;
  resumeInfo.value = null;
  currentIndex.value = progress.index;
  sessionStats.value = progress.stats || sessionStats.value;
  againCountMap.value = progress.againMap || {};
  studyMode.value = progress.mode || 'flashcard';
  modeSelected.value = true;
  if (studyMode.value === 'choice') loadChoices();
  if (studyMode.value === 'spelling' || studyMode.value === 'listening') {
    nextTick(() => {
      (spellingInputRef.value || listeningInputRef.value)?.focus();
    });
  }
};

const dismissResume = () => {
  resumeInfo.value = null;
  clearProgress();
};

// 完成后重播功能
const replayWithNewMode = () => {
  queue.value = [...originalQueue.value];
  currentIndex.value = 0;
  finished.value = false;
  modeSelected.value = false;
  showAnswer.value = false;
  sessionStats.value = { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
  againCountMap.value = {};
};

const replayAgainWords = () => {
  const ids = new Set(againWordIds.value);
  queue.value = originalQueue.value.filter(item => ids.has(item.wordId));
  originalQueue.value = [...queue.value];
  currentIndex.value = 0;
  finished.value = false;
  modeSelected.value = false;
  showAnswer.value = false;
  sessionStats.value = { total: 0, again: 0, hard: 0, good: 0, easy: 0 };
  againCountMap.value = {};
};

// 保存进度
const saveProgress = () => {
  const data = {
    index: currentIndex.value,
    stats: sessionStats.value,
    againMap: againCountMap.value,
    mode: studyMode.value,
    queueIds: queue.value.map(r => r.wordId).join(','),
  };
  localStorage.setItem('study-session-progress', JSON.stringify(data));
};

const clearProgress = () => {
  localStorage.removeItem('study-session-progress');
};

const flipCard = () => {
  showAnswer.value = true;
  if (currentCard.value) {
    speak(currentCard.value.word.name);
  }
};

const advanceCard = () => {
  currentIndex.value++;
  showAnswer.value = false;
  choiceAnswered.value = false;
  choiceSelected.value = -1;
  spellingInput.value = '';
  spellingAnswered.value = false;
  spellingCorrect.value = false;
  spellingHintLevel.value = 0;

  if (currentIndex.value >= queue.value.length) {
    finished.value = true;
    clearProgress();
  } else {
    saveProgress();
    if (studyMode.value === 'choice') loadChoices();
    if (studyMode.value === 'spelling' || studyMode.value === 'listening') {
      nextTick(() => {
        (spellingInputRef.value || listeningInputRef.value)?.focus();
      });
    }
  }
};

const submitRating = async (quality) => {
  if (submitting.value) return;
  submitting.value = true;

  const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

  try {
    await submitReviewResult(currentCard.value.wordId, quality);
    sessionStats.value.total++;
    sessionStats.value[qualityMap[quality]]++;

    if (quality === 1) {
      const wId = currentCard.value.wordId;
      const count = againCountMap.value[wId] || 0;
      if (count < MAX_AGAIN_PER_WORD) {
        againCountMap.value[wId] = count + 1;
        queue.value.push({ ...currentCard.value });
      }
    }

    advanceCard();
  } catch {
    ElMessage.error('提交复习结果失败');
  } finally {
    submitting.value = false;
  }
};

// ===== 选择题模式 =====
const loadChoices = async () => {
  if (!currentCard.value) return;
  try {
    const res = await getQuizChoices(currentCard.value.word.id, 3);
    const all = [res.data.correct, ...res.data.distractors];
    // 随机排列
    choiceOptions.value = all.sort(() => Math.random() - 0.5);
  } catch {
    // 降级：用当前卡片的释义
    choiceOptions.value = [{ id: currentCard.value.word.id, meaning: currentCard.value.word.meaning }];
  }
};

const handleChoice = async (idx) => {
  choiceSelected.value = idx;
  choiceAnswered.value = true;
  const correct = choiceOptions.value[idx].id === currentCard.value.word.id;
  // 自动评分：正确 = good(3)，错误 = again(1)
  const quality = correct ? 3 : 1;
  submitting.value = true;
  try {
    await submitReviewResult(currentCard.value.wordId, quality);
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    sessionStats.value.total++;
    sessionStats.value[qualityMap[quality]]++;

    if (quality === 1) {
      const wId = currentCard.value.wordId;
      const count = againCountMap.value[wId] || 0;
      if (count < MAX_AGAIN_PER_WORD) {
        againCountMap.value[wId] = count + 1;
        queue.value.push({ ...currentCard.value });
      }
    }
  } catch {
    ElMessage.error('提交结果失败');
  } finally {
    submitting.value = false;
  }
};

const choiceNext = () => {
  advanceCard();
};

// ===== 拼写 & 听力模式 =====
const checkSpelling = async () => {
  if (!spellingInput.value.trim() || spellingAnswered.value) return;
  spellingAnswered.value = true;
  spellingCorrect.value = spellingInput.value.trim().toLowerCase() === currentCard.value.word.name.toLowerCase();

  const quality = spellingCorrect.value ? 3 : 1; // 拼写正确等同「认识」（good），而非「很熟悉」（easy）
  submitting.value = true;
  try {
    await submitReviewResult(currentCard.value.wordId, quality);
    const qualityMap = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    sessionStats.value.total++;
    sessionStats.value[qualityMap[quality]]++;

    if (quality === 1) {
      const wId = currentCard.value.wordId;
      const count = againCountMap.value[wId] || 0;
      if (count < MAX_AGAIN_PER_WORD) {
        againCountMap.value[wId] = count + 1;
        queue.value.push({ ...currentCard.value });
      }
    }
  } catch {
    ElMessage.error('提交结果失败');
  } finally {
    submitting.value = false;
  }
};

const showSpellingHint = () => {
  spellingHintLevel.value = Math.min(spellingHintLevel.value + 1, 2);
};

const spellingNext = () => {
  advanceCard();
};

// 键盘快捷键
const handleKeyDown = (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (studyMode.value === 'flashcard' && modeSelected.value && !finished.value && currentCard.value) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!showAnswer.value) flipCard();
    }
    if (showAnswer.value && !submitting.value) {
      if (e.key === '1') submitRating(1);
      else if (e.key === '2') submitRating(2);
      else if (e.key === '3') submitRating(3);
      else if (e.key === '4') submitRating(4);
    }
  }
};

onMounted(() => {
  fetchDue();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
