<template>
  <div class="study-report">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习报表</el-breadcrumb-item>
    </el-breadcrumb>

    <div class="report-header">
      <h2>学习时间中心</h2>
      <div class="report-actions">
        <el-select v-model="days" @change="fetchData" style="width: 130px">
          <el-option :value="7" label="最近 7 天" />
          <el-option :value="30" label="最近 30 天" />
          <el-option :value="90" label="最近 90 天" />
        </el-select>
        <el-button type="primary" plain :loading="exporting" @click="handleExport">
          导出记录
        </el-button>
      </div>
    </div>

    <!-- 主时间统计卡片 -->
    <el-row :gutter="20" class="report-summary" v-loading="loading">
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon time-total-icon">⏱</div>
          <div class="card-info">
            <div class="card-title">累计学习时长</div>
            <div class="card-value">{{ formatSecondsShort(report.totalSeconds) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon time-7d-icon">📅</div>
          <div class="card-info">
            <div class="card-title">近 7 天学习</div>
            <div class="card-value">{{ formatSecondsShort(report.sevenDaySeconds) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon time-30d-icon">📆</div>
          <div class="card-info">
            <div class="card-title">近 30 天学习</div>
            <div class="card-value">{{ formatSecondsShort(report.thirtyDaySeconds) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon streak-icon">🔥</div>
          <div class="card-info">
            <div class="card-title">连续学习</div>
            <div class="card-value">
              {{ report.streakDays }} <span class="unit">天</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 次要统计卡片 -->
    <el-row :gutter="20" class="report-secondary" v-loading="loading">
      <el-col :span="6" :xs="12">
        <el-card shadow="never" class="data-card secondary-card">
          <div class="card-icon avg-icon">📈</div>
          <div class="card-info">
            <div class="card-title">
              日均学习时长<span class="card-title-hint">（活跃日）</span>
            </div>
            <div class="card-value secondary-value">
              {{ formatSecondsShort(report.avgDailySeconds) }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="never" class="data-card secondary-card">
          <div class="card-icon sessions-icon">🗂</div>
          <div class="card-info">
            <div class="card-title">累计学习次数</div>
            <div class="card-value secondary-value">
              {{ report.totalSessions }} <span class="unit">次</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="never" class="data-card secondary-card">
          <div class="card-icon avg-session-icon">⌀</div>
          <div class="card-info">
            <div class="card-title">单次平均时长</div>
            <div class="card-value secondary-value">
              {{ formatSecondsShort(report.avgSessionSeconds) }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="never" class="data-card secondary-card">
          <div class="card-icon mastery-icon">🎯</div>
          <div class="card-info">
            <div class="card-title">词汇掌握率</div>
            <div class="card-value secondary-value">
              {{ masteryRate }}<span class="unit">%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row
      :gutter="20"
      class="charts-row"
      v-if="report.dailyBuckets.length > 0"
      v-loading="loading"
    >
      <el-col :span="16" :xs="24" class="chart-col">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>每日学习时长</span>
            </div>
          </template>
          <div ref="dailyChartRef" class="echart-container"></div>
        </el-card>
      </el-col>

      <el-col :span="8" :xs="24" class="chart-col">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>词汇掌握分布</span>
            </div>
          </template>
          <div ref="masteryChartRef" class="echart-container mastery-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近学习记录 -->
    <el-card
      shadow="never"
      class="recent-card"
      v-if="!loading && report.recentSessions.length > 0"
    >
      <template #header>
        <div class="card-header">
          <span>最近学习记录</span>
        </div>
      </template>
      <el-table :data="report.recentSessions" stripe size="small">
        <el-table-column label="开始时间" min-width="150">
          <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="时长" min-width="100">
          <template #default="{ row }">{{ formatSecondsText(row.durationSeconds) }}</template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <span :class="row.note ? '' : 'session-note-empty'">{{ row.note || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 空状态 -->
    <div v-if="!loading && isEmpty" class="report-empty">
      <el-empty description="暂无学习记录，开启计时器开始学习后这里会显示你的时间统计。" />
      <el-button type="primary" size="large" @click="$router.push('/study')">去学习</el-button>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted, nextTick, shallowRef, watch } from 'vue';
  import { ElMessage } from 'element-plus';
  import * as echarts from 'echarts';
  import { getStudyTimeReport, getReviewStats, exportStudySessions } from '../api/index.js';

  // ── 响应式状态 ──────────────────────────────────────────────────────────────
  const loading = ref(true);
  const exporting = ref(false);
  const days = ref(30);

  /** 报表核心数据，与后端 /study-sessions/report 响应字段一一对应 */
  const report = ref({
    totalSeconds: 0,
    sevenDaySeconds: 0,
    thirtyDaySeconds: 0,
    streakDays: 0,
    totalSessions: 0,
    avgSessionSeconds: 0,
    avgDailySeconds: 0,
    activeDaysInRange: 0,
    dailyBuckets: [],
    recentSessions: [],
  });

  /** 词汇统计（保留为辅助信息，用于掌握率饼图） */
  const wordStats = ref({ total: 0, known: 0, learning: 0 });

  // ── 图表 refs ────────────────────────────────────────────────────────────────
  const dailyChartRef = ref(null);
  const masteryChartRef = ref(null);
  const dailyChartInstance = shallowRef(null);
  const masteryChartInstance = shallowRef(null);

  // ── 计算属性 ─────────────────────────────────────────────────────────────────
  const masteryRate = computed(() => {
    if (!wordStats.value.total) return 0;
    return Math.round((wordStats.value.known / wordStats.value.total) * 100);
  });

  const isEmpty = computed(() => report.value.totalSessions === 0);

  // ── 格式化工具函数 ────────────────────────────────────────────────────────────

  /**
   * 将秒数格式化为简短人类可读形式，适用于统计卡片主数字。
   * @param {number} seconds
   * @returns {string}  例：0 分钟 / 45 分钟 / 2 时 30 分 / 3 小时
   */
  function formatSecondsShort(seconds) {
    if (!seconds) return '0 分钟';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h} 时 ${m} 分`;
    if (h > 0) return `${h} 小时`;
    return `${m || 1} 分钟`;
  }

  /**
   * 将秒数格式化为精确文本，适用于表格/提示。
   * @param {number} seconds
   * @returns {string}  例：< 1 分钟 / 5分30秒 / 1时20分
   */
  function formatSecondsText(seconds) {
    if (!seconds) return '< 1 分钟';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return m > 0 ? `${h}时${m}分` : `${h}小时`;
    if (m > 0) return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
    return `${s}秒`;
  }

  /**
   * 将 ISO 时间字符串格式化为本地日期时间，适用于记录列表。
   * @param {string} isoStr
   * @returns {string}
   */
  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  // ── 图表渲染 ─────────────────────────────────────────────────────────────────
  function updateCharts() {
    renderDailyChart();
    renderMasteryChart();
  }

  function renderDailyChart() {
    if (!dailyChartInstance.value || !report.value.dailyBuckets.length) return;

    const buckets = report.value.dailyBuckets;
    const dates = buckets.map((b) => b.date.slice(5)); // MM-DD
    const minuteData = buckets.map((b) => +(b.seconds / 60).toFixed(1));

    // x 轴标签密度：天数多时自动稀疏
    const labelInterval = days.value > 30 ? 6 : days.value > 7 ? 2 : 0;

    dailyChartInstance.value.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter(params) {
          const idx = params[0].dataIndex;
          const rawSeconds = buckets[idx]?.seconds || 0;
          return `${buckets[idx]?.date}<br/>学习时长：${formatSecondsText(rawSeconds)}`;
        },
      },
      grid: { left: '2%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: '#909399', interval: labelInterval },
        axisLine: { lineStyle: { color: '#E4E7ED' } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#EBEEF5' } },
        axisLabel: { color: '#909399', formatter: (v) => `${v}分` },
      },
      color: ['#667eea'],
      series: [
        {
          name: '学习时长',
          type: 'bar',
          barMaxWidth: 40,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: minuteData,
        },
      ],
    });
  }

  function renderMasteryChart() {
    if (!masteryChartInstance.value) return;

    const { known, learning } = wordStats.value;
    masteryChartInstance.value.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: <br/>{c} 词 ({d}%)' },
      legend: {
        bottom: '0%',
        left: 'center',
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#606266' },
      },
      color: ['#67C23A', '#409EFF'],
      series: [
        {
          name: '掌握度',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 16, fontWeight: 'bold', formatter: '{b}\n{d}%' },
          },
          labelLine: { show: false },
          data: [
            { value: known, name: '已掌握' },
            { value: learning, name: '学习中' },
          ],
        },
      ],
    });
  }

  function handleResize() {
    dailyChartInstance.value?.resize();
    masteryChartInstance.value?.resize();
  }

  // 数据或词汇统计变化时重绘图表
  watch([() => report.value.dailyBuckets, wordStats], () => nextTick(updateCharts), { deep: true });

  // ── 数据获取 ─────────────────────────────────────────────────────────────────
  async function fetchData() {
    loading.value = true;
    try {
      const [reportRes, statsRes] = await Promise.all([
        getStudyTimeReport(days.value),
        getReviewStats(),
      ]);
      report.value = reportRes.data;
      wordStats.value = statsRes.data;

      nextTick(() => {
        if (!dailyChartInstance.value && dailyChartRef.value) {
          dailyChartInstance.value = echarts.init(dailyChartRef.value);
        }
        if (!masteryChartInstance.value && masteryChartRef.value) {
          masteryChartInstance.value = echarts.init(masteryChartRef.value);
        }
        updateCharts();
      });
    } catch {
      ElMessage.error('获取报表数据失败');
    } finally {
      loading.value = false;
    }
  }

  // ── 导出 ─────────────────────────────────────────────────────────────────────
  async function handleExport() {
    exporting.value = true;
    try {
      const blob = await exportStudySessions();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-sessions-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('导出成功');
    } catch {
      ElMessage.error('导出失败');
    } finally {
      exporting.value = false;
    }
  }

  // ── 生命周期 ─────────────────────────────────────────────────────────────────
  onMounted(() => {
    fetchData();
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    dailyChartInstance.value?.dispose();
    masteryChartInstance.value?.dispose();
  });
</script>
