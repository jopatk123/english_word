<template>
  <div class="study-dashboard">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>背单词</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 统计卡片 -->
    <div class="stats-cards" v-loading="statsLoading">
      <div class="stat-card stat-due" @click="startStudy">
        <div class="stat-number">{{ stats.todayDue }}</div>
        <div class="stat-label">今日到期</div>
      </div>
      <div
        class="stat-card stat-overdue"
        :class="{ clickable: stats.overdue > 0 }"
        @click="stats.overdue > 0 && startStudy()"
      >
        <div class="stat-number">{{ stats.overdue }}</div>
        <div class="stat-label">超期未复习</div>
      </div>
      <div class="stat-card stat-today">
        <div class="stat-number">{{ stats.todayReviewed }}</div>
        <div class="stat-label">今日已复习</div>
      </div>
      <div class="stat-card stat-week">
        <div class="stat-number">{{ stats.weekDue }}</div>
        <div class="stat-label">本周剩余</div>
      </div>
      <div class="stat-card stat-learning">
        <div class="stat-number">{{ stats.learning + stats.new }}</div>
        <div class="stat-label">学习中</div>
      </div>
      <div class="stat-card stat-known">
        <div class="stat-number">{{ stats.known }}</div>
        <div class="stat-label">已掌握</div>
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
        :disabled="stats.due === 0 && stats.weekDue === 0"
        @click="stats.due > 0 ? startStudy() : startAdvanceStudy()"
      >
        {{
          stats.due > 0
            ? `开始复习（${stats.due} 个）`
            : stats.weekDue > 0
              ? `提前复习（${stats.weekDue} 个）`
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
    <p v-if="stats.due === 0 && stats.weekDue > 0" class="advance-hint">
      🎉 今日任务已完成！本周还有 <strong>{{ stats.weekDue }}</strong> 个单词可提前复习。
    </p>
    <p v-else-if="stats.due === 0 && stats.weekDue === 0 && stats.total > 0" class="advance-hint">
      ✅ 近期暂无待复习单词，继续保持！
    </p>

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
  import { ref, computed, onMounted } from 'vue';
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
    weekDue: 0,
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

  const hasUnenrolledRoots = computed(() =>
    rootsProgress.value.some((r) => r.wordCount > 0 && r.enrolled < r.wordCount)
  );

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
    if (stats.value.due > 0) {
      router.push('/study/session');
    }
  };

  const startAdvanceStudy = () => {
    router.push({ path: '/study/session', query: { advance: 7 } });
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
    fetchStats();
    fetchRootsProgress();
  });
</script>
