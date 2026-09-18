<template>
  <div class="study-session">
    <div class="session-chrome">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
        <el-breadcrumb-item>学习中</el-breadcrumb-item>
      </el-breadcrumb>
      <SessionProgress
        v-if="showSessionProgress"
        :currentIndex="currentIndex"
        :total="queue.length"
        @seek="seekToIndex"
      >
        <template v-if="studyMode === 'autoRead'" #extra>
          <span class="auto-read-status" :class="{ 'is-paused': isAutoReadPaused }">
            {{ isAutoReadPaused ? '已暂停' : '朗读中' }}
          </span>
          <el-button
            class="auto-read-toggle"
            size="small"
            :type="isAutoReadPaused ? 'success' : 'warning'"
            @click="toggleAutoReadPause"
          >
            {{ isAutoReadPaused ? '继续' : '暂停' }}
          </el-button>
        </template>
      </SessionProgress>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="session-loading"
      v-loading="true"
      element-loading-text="加载复习内容..."
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
      :showAnswer="showAnswer"
      :submitting="submitting"
      :againCountMap="againCountMap"
      :regeneratingExampleId="regeneratingExampleId"
      @flip="flipCard"
      @rate="submitRating"
      @regenerate-example="regenerateExample"
    />

    <!-- 选择题模式 -->
    <ChoiceMode
      v-else-if="currentCard && studyMode === 'choice'"
      :card="currentCard"
      :choiceOptions="choiceOptions"
      :choiceSelected="choiceSelected"
      :choiceAnswered="choiceAnswered"
      :submitting="submitting"
      :isLast="currentIndex + 1 >= queue.length"
      @choose="handleChoice"
      @next="choiceNext"
    />

    <!-- 拼写模式 -->
    <SpellingMode
      v-else-if="currentCard && studyMode === 'spelling'"
      :card="currentCard"
      :currentIndex="currentIndex"
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
    />

    <!-- 听力模式 -->
    <ListeningMode
      v-else-if="currentCard && studyMode === 'listening'"
      :card="currentCard"
      :currentIndex="currentIndex"
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
    />

    <!-- 自动朗读模式 -->
    <AutoReadMode v-else-if="currentCard && studyMode === 'autoRead'" :card="currentCard" />

    <!-- 无待复习 -->
    <div v-else class="session-empty">
      <p>暂无待复习的单词</p>
      <el-button type="primary" @click="$router.push('/study')">返回仪表盘</el-button>
    </div>
  </div>
</template>

<script setup>
  import { computed, unref } from 'vue';
  import { useStudySession } from '../composables/useStudySession.js';
  import ModeSelect from '../components/study/ModeSelect.vue';
  import SessionProgress from '../components/study/SessionProgress.vue';
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
    regeneratingExampleId,
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
    isAutoReadPaused,
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
    regenerateExample,
    toggleAutoReadPause,
    handleChoice,
    choiceNext,
    checkSpelling,
    showSpellingHint,
    spellingNext,
  } = useStudySession();

  const showSessionProgress = computed(() =>
    Boolean(unref(modeSelected) && unref(currentCard) && !unref(finished) && unref(queue)?.length)
  );
</script>
