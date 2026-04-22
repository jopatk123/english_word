<template>
  <div class="study-session">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习中</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="session-loading"
      v-loading="true"
      element-loading-text="加载学习队列..."
    />

    <!-- 模式选择（学习开始前） -->
    <ModeSelect
      v-else-if="!modeSelected && queue.length > 0"
      :queueLength="queue.length"
      :resumeInfo="resumeInfo"
      :modeNames="modeNames"
      @select="selectMode"
      @resume="applyResume"
      @dismiss="dismissResume"
    />

    <!-- 学习完成 -->
    <SessionComplete
      v-else-if="finished"
      :sessionStats="sessionStats"
      :hasAgainWords="hasAgainWords"
      :againWordCount="againWordCount"
      :totalWords="originalQueueLength"
      @replay="replayWithNewMode"
      @replay-again="replayAgainWords"
      @continue-review="continueReview"
    />

    <!-- 闪卡模式 -->
    <FlashcardMode
      v-else-if="currentCard && studyMode === 'flashcard'"
      :card="currentCard"
      :currentIndex="currentIndex"
      :total="queue.length"
      :showAnswer="showAnswer"
      :submitting="submitting"
      :againCountMap="againCountMap"
      @flip="flipCard"
      @rate="submitRating"
      @seek="seekToIndex"
    />

    <!-- 选择题模式 -->
    <ChoiceMode
      v-else-if="currentCard && studyMode === 'choice'"
      :card="currentCard"
      :currentIndex="currentIndex"
      :total="queue.length"
      :choiceOptions="choiceOptions"
      :choiceSelected="choiceSelected"
      :choiceAnswered="choiceAnswered"
      :submitting="submitting"
      :isLast="currentIndex + 1 >= queue.length"
      @choose="handleChoice"
      @next="choiceNext"
      @seek="seekToIndex"
    />

    <!-- 拼写模式 -->
    <SpellingMode
      v-else-if="currentCard && studyMode === 'spelling'"
      :card="currentCard"
      :currentIndex="currentIndex"
      :total="queue.length"
      v-model:inputValue="spellingInput"
      :answered="spellingAnswered"
      :correct="spellingCorrect"
      :hard="spellingHard"
      :submitting="submitting"
      :spellingHint="spellingHint"
      :isLast="currentIndex + 1 >= queue.length"
      @check="checkSpelling"
      @hint="showSpellingHint"
      @next="spellingNext"
      @seek="seekToIndex"
    />

    <!-- 听力模式 -->
    <ListeningMode
      v-else-if="currentCard && studyMode === 'listening'"
      :card="currentCard"
      :currentIndex="currentIndex"
      :total="queue.length"
      v-model:inputValue="spellingInput"
      :answered="spellingAnswered"
      :correct="spellingCorrect"
      :hard="spellingHard"
      :submitting="submitting"
      :hint="spellingHint"
      :hintLevel="spellingHintLevel"
      :isLast="currentIndex + 1 >= queue.length"
      @check="checkSpelling"
      @hint="showSpellingHint"
      @next="spellingNext"
      @seek="seekToIndex"
    />

    <!-- 自动朗读模式 -->
    <AutoReadMode
      v-else-if="currentCard && studyMode === 'autoRead'"
      :card="currentCard"
      :currentIndex="currentIndex"
      :total="queue.length"
      @seek="seekToIndex"
    />

    <!-- 无待复习 -->
    <div v-else class="session-empty">
      <p>暂无待复习的单词</p>
      <el-button type="primary" @click="$router.push('/study')">返回仪表盘</el-button>
    </div>
  </div>
</template>

<script setup>
  import { useStudySession } from '../composables/useStudySession.js';
  import ModeSelect from '../components/study/ModeSelect.vue';
  import SessionComplete from '../components/study/SessionComplete.vue';
  import FlashcardMode from '../components/study/FlashcardMode.vue';
  import ChoiceMode from '../components/study/ChoiceMode.vue';
  import SpellingMode from '../components/study/SpellingMode.vue';
  import ListeningMode from '../components/study/ListeningMode.vue';
  import AutoReadMode from '../components/study/AutoReadMode.vue';

  const {
    loading,
    queue,
    currentIndex,
    showAnswer,
    submitting,
    finished,
    sessionStats,
    againCountMap,
    resumeInfo,
    studyMode,
    modeSelected,
    modeNames,
    currentCard,
    choiceOptions,
    choiceSelected,
    choiceAnswered,
    spellingInput,
    spellingAnswered,
    spellingCorrect,
    spellingHard,
    spellingHint,
    spellingHintLevel,
    hasAgainWords,
    againWordCount,
    originalQueueLength,
    selectMode,
    seekToIndex,
    applyResume,
    dismissResume,
    replayWithNewMode,
    replayAgainWords,
    continueReview,
    flipCard,
    submitRating,
    handleChoice,
    choiceNext,
    checkSpelling,
    showSpellingHint,
    spellingNext,
  } = useStudySession();
</script>
