<template>
  <div class="study-report">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/study' }">背单词</el-breadcrumb-item>
      <el-breadcrumb-item>学习报表</el-breadcrumb-item>
    </el-breadcrumb>

    <div class="report-header">
      <h2>学习数据中心</h2>
      <div class="report-actions">
        <el-select v-model="days" @change="fetchData" style="width: 130px">
          <el-option :value="7" label="最近 7 天" />
          <el-option :value="30" label="最近 30 天" />
          <el-option :value="90" label="最近 90 天" />
        </el-select>
        <el-dropdown @command="handleExport">
          <el-button type="primary" plain>
            导出报告 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
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
    <el-row :gutter="20" class="report-summary" v-loading="loading">
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon streak-icon">🔥</div>
          <div class="card-info">
            <div class="card-title">连续学习</div>
            <div class="card-value">{{ summary.streak }} <span class="unit">天</span></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon total-icon">📊</div>
          <div class="card-info">
            <div class="card-title">总复习次数</div>
            <div class="card-value">{{ summary.totalReviews }} <span class="unit">次</span></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon avg-icon">📈</div>
          <div class="card-info">
            <div class="card-title">日均复习</div>
            <div class="card-value">{{ avgDaily }} <span class="unit">次</span></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6" :xs="12">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon mastery-icon">🎯</div>
          <div class="card-info">
            <div class="card-title">整体掌握率</div>
            <div class="card-value">{{ masteryRate }}<span class="unit">%</span></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row
      :gutter="20"
      class="charts-row"
      v-if="summary.daily && summary.daily.length > 0"
      v-loading="loading"
    >
      <el-col :span="16" :xs="24" class="chart-col">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>每日复习量分布</span>
            </div>
          </template>
          <div ref="dailyChartRef" class="echart-container"></div>
        </el-card>
      </el-col>

      <el-col :span="8" :xs="24" class="chart-col">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>当前词汇掌握度</span>
            </div>
          </template>
          <div ref="masteryChartRef" class="echart-container mastery-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <div v-if="!loading && summary.daily && summary.daily.length === 0" class="report-empty">
      <el-empty description="暂无学习记录，开始学习后这里会显示你的进度报表。" />
      <el-button type="primary" size="large" @click="$router.push('/study')">去学习</el-button>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted, nextTick, shallowRef, watch } from 'vue';
  import { ArrowDown } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import * as echarts from 'echarts';
  import { getReviewStats, getReviewHistorySummary, exportReviewData } from '../api/index.js';

  const loading = ref(true);
  const days = ref(30);
  const summary = ref({ daily: [], streak: 0, totalReviews: 0 });
  const stats = ref({ total: 0, known: 0, learning: 0, new: 0 });

  const dailyChartRef = ref(null);
  const masteryChartRef = ref(null);
  const dailyChartInstance = shallowRef(null);
  const masteryChartInstance = shallowRef(null);

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
    (summary.value.daily || []).forEach((d) => {
      dailyMap[d.date] = d;
    });

    const result = [];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days.value + 1);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      result.push(
        dailyMap[dateStr] || { date: dateStr, total: 0, again: 0, hard: 0, good: 0, easy: 0 }
      );
    }
    return result;
  });

  const updateCharts = () => {
    if (dailyChartInstance.value) {
      const dates = displayDaily.value.map((d) => d.date.slice(5)); // MM-DD
      const goodData = displayDaily.value.map((d) => d.good + d.easy);
      const hardData = displayDaily.value.map((d) => d.hard);
      const againData = displayDaily.value.map((d) => d.again);

      dailyChartInstance.value.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        legend: {
          data: ['掌握', '困难', '再来'],
        },
        grid: {
          left: '2%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisTick: { alignWithLabel: true },
          axisLabel: {
            color: '#909399',
          },
          axisLine: {
            lineStyle: { color: '#E4E7ED' },
          },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { type: 'dashed', color: '#EBEEF5' } },
          axisLabel: { color: '#909399' },
        },
        color: ['#67C23A', '#E6A23C', '#F56C6C'],
        series: [
          { name: '掌握', type: 'bar', stack: 'total', barMaxWidth: 40, data: goodData },
          { name: '困难', type: 'bar', stack: 'total', barMaxWidth: 40, data: hardData },
          {
            name: '再来',
            type: 'bar',
            stack: 'total',
            barMaxWidth: 40,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
            data: againData,
          },
        ],
      });
    }

    if (masteryChartInstance.value) {
      const known = stats.value.known;
      const reviewing = stats.value.total - known - stats.value.new - stats.value.learning;
      const learning = stats.value.learning;
      const newWords = stats.value.new;

      masteryChartInstance.value.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{b}: <br/>{c} 词 ({d}%)',
        },
        legend: {
          bottom: '0%',
          left: 'center',
          icon: 'circle',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: '#606266' },
        },
        color: ['#67C23A', '#409EFF', '#E6A23C', '#909399'],
        series: [
          {
            name: '掌握度',
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 8,
              borderColor: '#fff',
              borderWidth: 2,
            },
            label: { show: false, position: 'center' },
            emphasis: {
              label: {
                show: true,
                fontSize: 16,
                fontWeight: 'bold',
                formatter: '{b}\n{d}%',
              },
            },
            labelLine: { show: false },
            data: [
              { value: known, name: '已掌握' },
              { value: reviewing, name: '复习中' },
              { value: learning, name: '学习中' },
              { value: newWords, name: '新词' },
            ],
          },
        ],
      });
    }
  };

  const handleResize = () => {
    dailyChartInstance.value?.resize();
    masteryChartInstance.value?.resize();
  };

  watch(
    [displayDaily, stats],
    () => {
      nextTick(() => {
        updateCharts();
      });
    },
    { deep: true }
  );

  const fetchData = async () => {
    loading.value = true;
    try {
      const [summaryRes, statsRes] = await Promise.all([
        getReviewHistorySummary(days.value),
        getReviewStats(),
      ]);
      summary.value = summaryRes.data;
      stats.value = statsRes.data;

      nextTick(() => {
        // Init charts if not yet created but refs are ready
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
  };

  const handleExport = async (format) => {
    try {
      const res = await exportReviewData(format);
      const blob = new Blob([format === 'csv' ? res : JSON.stringify(res, null, 2)], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      });
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
