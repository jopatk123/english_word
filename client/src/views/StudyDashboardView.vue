<template>
  <div class="study-dashboard">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>背单词</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 统计卡片 -->
    <div class="stats-cards" v-loading="statsLoading">
      <div
        class="stat-card stat-due"
        :class="{ clickable: stats.due > 0 }"
        @click="openSessionFor('due', stats.due)"
      >
        <div class="stat-number stat-number-primary">{{ stats.due }}</div>
        <div class="stat-label">待复习</div>
        <div class="stat-meta">今日到期 {{ stats.todayDue }} · 超期 {{ stats.overdue }}</div>
      </div>
      <div
        class="stat-card stat-today"
        :class="{ clickable: stats.todayReviewed > 0 }"
        @click="openSessionFor('today-reviewed', stats.todayReviewed)"
      >
        <div class="stat-number">{{ stats.todayReviewed }}</div>
        <div class="stat-label">今日已复习</div>
      </div>
      <div
        class="stat-card stat-total"
        :class="{ clickable: stats.total > 0 }"
        @click="openSessionFor('all', stats.total)"
      >
        <div class="stat-number">{{ stats.total }}</div>
        <div class="stat-label">总单词数</div>
      </div>
      <div
        class="stat-card stat-learning"
        :class="{ clickable: stats.learning > 0 }"
        @click="openSessionFor('learning', stats.learning)"
      >
        <div class="stat-number">{{ stats.learning }}</div>
        <div class="stat-label">学习中</div>
      </div>
      <div
        class="stat-card stat-known"
        :class="{ clickable: stats.known > 0 }"
        @click="openSessionFor('known', stats.known)"
      >
        <div class="stat-number">{{ stats.known }}</div>
        <div class="stat-label">已掌握</div>
      </div>
      <div
        class="stat-card stat-reminder"
        :class="{ clickable: studyReminder.clickable }"
        @click="openSessionFor(studyReminder.scope, studyReminder.count)"
      >
        <div class="stat-reminder-detail">{{ studyReminder.detail }}</div>
        <div class="stat-reminder-footer">
          <span class="stat-reminder-badge">{{ studyReminder.badge }}</span>
          <span class="stat-reminder-action">{{ studyReminder.actionText }}</span>
        </div>
      </div>
    </div>

    <!-- 学习激励 -->
    <div class="incentive-section" v-if="streak > 0 || totalReviews30d > 0">
      <div class="incentive-item" v-if="streak > 0">
        🔥 连续学习 <strong>{{ streak }}</strong> 天
      </div>
      <div class="incentive-item" v-if="totalReviews30d > 0">
        📊 近30天共复习 <strong>{{ totalReviews30d }}</strong> 次
      </div>
    </div>

    <!-- 开始学习按钮 -->
    <div class="start-section start-section-centered">
      <el-button
        type="primary"
        size="large"
        :disabled="stats.due === 0 && stats.total === 0"
        @click="handlePrimaryStudyAction"
      >
        {{
          stats.due > 0
            ? `开始复习（${stats.due} 个）`
            : stats.total > 0
              ? `继续复习（${stats.total} 个）`
              : '暂无待复习单词'
        }}
      </el-button>
      <el-button size="large" @click="$router.push('/study/report')"> 学习报表 </el-button>
      <el-button size="large" :loading="exporting" @click="handleExport"> 数据导出 </el-button>
      <el-button size="large" @click="triggerImport"> 数据导入 </el-button>
      <!-- 隐藏的文件输入 -->
      <input
        ref="importFileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleImportFile"
      />
    </div>
    <!-- 词根列表（管理学习队列） -->
    <div class="root-section">
      <div class="section-header">
        <h3>按词根管理学习队列</h3>
        <el-button
          size="small"
          type="primary"
          plain
          :loading="enqueuingAll"
          :disabled="!hasUnenrolledRoots"
          @click="handleEnqueueAll"
        >
          全部加入学习
        </el-button>
      </div>

      <el-table
        :data="rootsProgress"
        stripe
        v-loading="rootsLoading"
        empty-text="暂无词根，请先添加词根和单词"
      >
        <el-table-column prop="name" label="词根" min-width="100">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/root/${row.id}`)">
              <strong>{{ row.name }}</strong>
            </el-link>
            <el-tag
              v-if="row.isDefault"
              type="info"
              size="small"
              style="display: block; margin-top: 4px; width: fit-content"
              >未分类</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="含义" min-width="120" />
        <el-table-column label="进度" min-width="180">
          <template #default="{ row }">
            <div class="progress-info">
              <el-progress
                :percentage="row.wordCount ? Math.round((row.enrolled / row.wordCount) * 100) : 0"
                :stroke-width="14"
                :format="() => `${row.enrolled}/${row.wordCount}`"
              />
              <span v-if="row.known > 0" class="known-badge"> 已掌握 {{ row.known }} </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.enrolled < row.wordCount"
              link
              type="primary"
              @click="handleEnqueue(row)"
              :loading="enqueuingId === row.id"
            >
              加入学习
            </el-button>
            <el-tag v-else size="small" type="success">已全部加入</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import {
    getReviewStats,
    getRootsProgress,
    enqueueRoot,
    getReviewHistorySummary,
    exportAllData,
    importAllData,
  } from '../api/index.js';

  const router = useRouter();

  const stats = ref({
    total: 0,
    due: 0,
    todayDue: 0,
    new: 0,
    learning: 0,
    known: 0,
    todayReviewed: 0,
    overdue: 0,
  });
  const statsLoading = ref(false);
  const rootsProgress = ref([]);
  const rootsLoading = ref(false);
  const enqueuingId = ref(null);
  const enqueuingAll = ref(false);
  const importing = ref(false);
  const exporting = ref(false);
  const importFileInput = ref(null);
  const streak = ref(0);
  const totalReviews30d = ref(0);
  let statsRefreshTimer = null;
  let lastStatsDate = '';

  const hasUnenrolledRoots = computed(() =>
    rootsProgress.value.some((r) => r.wordCount > 0 && r.enrolled < r.wordCount)
  );

  const studyReminder = computed(() => {
    const total = stats.value.total || 0;
    const due = stats.value.due || 0;
    const todayDue = stats.value.todayDue || 0;
    const overdue = stats.value.overdue || 0;

    if (total === 0) {
      return {
        clickable: false,
        scope: null,
        count: 0,
        badge: '先建词库',
        title: '还没有复习提醒',
        detail: '添加词根和单词后，系统会自动安排下一次复习',
        actionText: '去添加词根',
      };
    }

    if (due > 0) {
      return {
        clickable: true,
        scope: 'due',
        count: due,
        badge: overdue > 0 ? '优先处理' : '今天就复习',
        title: overdue > 0 ? '先处理超期词' : '今天安排复习',
        detail:
          overdue > 0
            ? `超期 ${overdue} 个 · 今日到期 ${todayDue} 个`
            : `今日到期 ${todayDue} 个 · 现在复习最合适`,
        actionText: `去复习（${due} 个）`,
      };
    }

    return {
      clickable: true,
      scope: 'continue',
      count: total,
      badge: '节奏稳定',
      title: '下一次复习建议',
      detail: '今天没有待完成任务，可以继续复习全部单词巩固记忆',
      actionText: `继续复习（${total} 个）`,
    };
  });

  const getLocalDateKey = () => new Date().toLocaleDateString('en-CA');

  const fetchStats = async () => {
    statsLoading.value = true;
    try {
      const [statsRes, summaryRes] = await Promise.all([
        getReviewStats(),
        getReviewHistorySummary(30),
      ]);
      stats.value = statsRes.data;
      streak.value = summaryRes.data.streak || 0;
      totalReviews30d.value = summaryRes.data.totalReviews || 0;
    } catch {
      ElMessage.error('获取学习统计失败');
    } finally {
      statsLoading.value = false;
    }
  };

  const fetchRootsProgress = async () => {
    rootsLoading.value = true;
    try {
      const res = await getRootsProgress();
      rootsProgress.value = res.data;
    } catch {
      ElMessage.error('获取词根进度失败');
    } finally {
      rootsLoading.value = false;
    }
  };

  const refreshStatsForCurrentDay = () => {
    lastStatsDate = getLocalDateKey();
    fetchStats();
  };

  const refreshStatsIfDateChanged = () => {
    const currentDate = getLocalDateKey();
    if (currentDate === lastStatsDate) return;
    lastStatsDate = currentDate;
    fetchStats();
  };

  const refreshStatsOnInterval = () => {
    if (document.visibilityState !== 'visible') return;

    const currentDate = getLocalDateKey();
    if (currentDate !== lastStatsDate) {
      lastStatsDate = currentDate;
    }

    fetchStats();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    refreshStatsForCurrentDay();
  };

  const handleWindowFocus = () => {
    refreshStatsForCurrentDay();
  };

  const handleEnqueue = async (root) => {
    enqueuingId.value = root.id;
    try {
      const res = await enqueueRoot(root.id);
      ElMessage.success(res.msg);
      fetchStats();
      fetchRootsProgress();
    } catch {
      ElMessage.error('加入学习队列失败');
    } finally {
      enqueuingId.value = null;
    }
  };

  const startStudy = () => {
    if (stats.value.due > 0) router.push('/study/session');
  };

  const startContinueStudy = () => {
    if (stats.value.total > 0) {
      router.push({ path: '/study/session', query: { scope: 'continue' } });
    }
  };

  const handlePrimaryStudyAction = () => {
    if (stats.value.due > 0) {
      startStudy();
    } else {
      startContinueStudy();
    }
  };

  const openSessionFor = (scope, count) => {
    if (!count) return;
    router.push({ path: '/study/session', query: { scope } });
  };

  const handleEnqueueAll = async () => {
    const unenrolled = rootsProgress.value.filter(
      (r) => r.wordCount > 0 && r.enrolled < r.wordCount
    );
    if (unenrolled.length === 0) return;
    enqueuingAll.value = true;
    try {
      for (const root of unenrolled) {
        await enqueueRoot(root.id);
      }
      ElMessage.success(`已将全部 ${unenrolled.length} 个词根的单词加入学习队列`);
      fetchStats();
      fetchRootsProgress();
    } catch {
      ElMessage.error('加入学习队列失败');
    } finally {
      enqueuingAll.value = false;
    }
  };

  const handleExport = async () => {
    exporting.value = true;
    try {
      const res = await exportAllData();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('导出成功');
    } catch {
      ElMessage.error('导出失败');
    } finally {
      exporting.value = false;
    }
  };

  const triggerImport = () => {
    if (importFileInput.value) importFileInput.value.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // 重置 input，允许重复选同一文件
    event.target.value = '';

    importing.value = true;
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return ElMessage.error('文件解析失败，请确认是有效的 JSON 文件');
      }
      const res = await importAllData(data);
      ElMessage.success(res.msg || '导入成功');
      fetchStats();
      fetchRootsProgress();
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '导入失败');
    } finally {
      importing.value = false;
    }
  };

  onMounted(() => {
    lastStatsDate = getLocalDateKey();
    fetchStats();
    fetchRootsProgress();
    statsRefreshTimer = window.setInterval(refreshStatsOnInterval, 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
  });

  onUnmounted(() => {
    if (statsRefreshTimer) {
      window.clearInterval(statsRefreshTimer);
      statsRefreshTimer = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
  });
</script>
