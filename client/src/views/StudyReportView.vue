<template>
  <div class="study-report">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习报表</el-breadcrumb-item>
    </el-breadcrumb>

    <div class="report-header">
      <h2>学习报表</h2>
      <div class="report-actions">
        <el-select v-model="days" @change="fetchData" style="width: 130px;">
          <el-option :value="7" label="最近7天" />
          <el-option :value="30" label="最近30天" />
          <el-option :value="90" label="最近90天" />
        </el-select>
        <el-dropdown @command="handleExport">
          <el-button>导出数据</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
              <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 概览统计卡片 -->
    <div class="report-summary" v-loading="loading">
      <div class="summary-card">
        <div class="summary-number">{{ summary.streak }}</div>
        <div class="summary-label">🔥 连续学习天数</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">{{ summary.totalReviews }}</div>
        <div class="summary-label">📊 总复习次数</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">{{ avgDaily }}</div>
        <div class="summary-label">📈 日均复习</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">{{ masteryRate }}%</div>
        <div class="summary-label">🎯 掌握率</div>
      </div>
    </div>

    <!-- 每日学习量柱状图（纯CSS） -->
    <div class="report-section" v-if="summary.daily && summary.daily.length > 0">
      <h3>每日复习量</h3>
      <div class="chart-container">
        <div class="bar-chart">
          <div
            v-for="day in displayDaily"
            :key="day.date"
            class="bar-group"
            :title="`${day.date}: ${day.total}次 (✅${day.good + day.easy} ❌${day.again})`"
          >
            <div class="bar-stack">
              <div class="bar bar-good" :style="{ height: barHeight(day.good + day.easy) }"></div>
              <div class="bar bar-hard" :style="{ height: barHeight(day.hard) }"></div>
              <div class="bar bar-again" :style="{ height: barHeight(day.again) }"></div>
            </div>
            <div class="bar-label">{{ day.date.slice(5) }}</div>
            <div class="bar-value">{{ day.total }}</div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background:#67c23a"></span>掌握</span>
          <span class="legend-item"><span class="legend-dot" style="background:#e6a23c"></span>困难</span>
          <span class="legend-item"><span class="legend-dot" style="background:#f56c6c"></span>再来</span>
        </div>
      </div>
    </div>

    <!-- 掌握度分布 -->
    <div class="report-section" v-if="stats.total > 0">
      <h3>掌握度分布</h3>
      <div class="mastery-distribution">
        <div class="mastery-row">
          <span class="mastery-label">已掌握</span>
          <div class="mastery-bar-bg">
            <div class="mastery-bar" style="background: #67c23a;" :style="{ width: pct(stats.known) }"></div>
          </div>
          <span class="mastery-count">{{ stats.known }}</span>
        </div>
        <div class="mastery-row">
          <span class="mastery-label">复习中</span>
          <div class="mastery-bar-bg">
            <div class="mastery-bar" style="background: #409eff;" :style="{ width: pct(stats.total - stats.known - stats.new - stats.learning) }"></div>
          </div>
          <span class="mastery-count">{{ stats.total - stats.known - stats.new - stats.learning }}</span>
        </div>
        <div class="mastery-row">
          <span class="mastery-label">学习中</span>
          <div class="mastery-bar-bg">
            <div class="mastery-bar" style="background: #e6a23c;" :style="{ width: pct(stats.learning) }"></div>
          </div>
          <span class="mastery-count">{{ stats.learning }}</span>
        </div>
        <div class="mastery-row">
          <span class="mastery-label">新词</span>
          <div class="mastery-bar-bg">
            <div class="mastery-bar" style="background: #909399;" :style="{ width: pct(stats.new) }"></div>
          </div>
          <span class="mastery-count">{{ stats.new }}</span>
        </div>
      </div>
    </div>

    <div v-if="!loading && summary.daily && summary.daily.length === 0" class="report-empty">
      <p>暂无学习记录，开始学习后这里会显示你的进度报表。</p>
      <el-button type="primary" @click="$router.push('/study')">去学习</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getReviewStats, getReviewHistorySummary, exportReviewData } from '../api/index.js';

const loading = ref(true);
const days = ref(30);
const summary = ref({ daily: [], streak: 0, totalReviews: 0 });
const stats = ref({ total: 0, known: 0, learning: 0, new: 0 });

const avgDaily = computed(() => {
  if (!summary.value.daily || summary.value.daily.length === 0) return 0;
  return Math.round(summary.value.totalReviews / Math.max(summary.value.daily.length, 1));
});

const masteryRate = computed(() => {
  if (!stats.value.total) return 0;
  return Math.round((stats.value.known / stats.value.total) * 100);
});

const displayDaily = computed(() => {
  // 填充空日期
  const dailyMap = {};
  (summary.value.daily || []).forEach(d => { dailyMap[d.date] = d; });

  const result = [];
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days.value + 1);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    result.push(dailyMap[dateStr] || { date: dateStr, total: 0, again: 0, hard: 0, good: 0, easy: 0 });
  }
  return result;
});

const maxDaily = computed(() => {
  return Math.max(...displayDaily.value.map(d => d.total), 1);
});

const barHeight = (count) => {
  if (!count) return '0px';
  return Math.max(2, (count / maxDaily.value) * 120) + 'px';
};

const pct = (count) => {
  if (!stats.value.total) return '0%';
  return Math.round((count / stats.value.total) * 100) + '%';
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [summaryRes, statsRes] = await Promise.all([
      getReviewHistorySummary(days.value),
      getReviewStats(),
    ]);
    summary.value = summaryRes.data;
    stats.value = statsRes.data;
  } catch {
    ElMessage.error('获取报表数据失败');
  } finally {
    loading.value = false;
  }
};

const handleExport = async (format) => {
  try {
    const res = await exportReviewData(format);
    const blob = new Blob(
      [format === 'csv' ? res : JSON.stringify(res, null, 2)],
      { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-data.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
};

onMounted(() => fetchData());
</script>
