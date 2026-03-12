<template>
  <div class="study-dashboard">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>背单词</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 统计卡片 -->
    <div class="stats-cards" v-loading="statsLoading">
      <div class="stat-card stat-due" @click="startStudy">
        <div class="stat-number">{{ stats.due }}</div>
        <div class="stat-label">今日待复习</div>
      </div>
      <div class="stat-card stat-today">
        <div class="stat-number">{{ stats.todayReviewed }}</div>
        <div class="stat-label">今日已复习</div>
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

    <!-- 开始学习按钮 -->
    <div class="start-section">
      <el-button
        type="primary"
        size="large"
        :disabled="stats.due === 0"
        @click="startStudy"
      >
        {{ stats.due > 0 ? `开始复习（${stats.due} 个）` : '暂无待复习单词' }}
      </el-button>
    </div>

    <!-- 词根列表（管理学习队列） -->
    <div class="root-section">
      <div class="section-header">
        <h3>按词根管理学习队列</h3>
      </div>

      <el-table :data="rootsProgress" stripe v-loading="rootsLoading" empty-text="暂无词根，请先添加词根和单词">
        <el-table-column prop="name" label="词根" min-width="100">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/root/${row.id}`)">
              <strong>{{ row.name }}</strong>
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="含义" min-width="120" />
        <el-table-column label="进度" min-width="180">
          <template #default="{ row }">
            <div class="progress-info">
              <el-progress
                :percentage="row.wordCount ? Math.round(row.enrolled / row.wordCount * 100) : 0"
                :stroke-width="14"
                :format="() => `${row.enrolled}/${row.wordCount}`"
              />
              <span v-if="row.known > 0" class="known-badge">
                已掌握 {{ row.known }}
              </span>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getReviewStats, getRootsProgress, enqueueRoot } from '../api/index.js';

const router = useRouter();

const stats = ref({ total: 0, due: 0, new: 0, learning: 0, known: 0, todayReviewed: 0 });
const statsLoading = ref(false);
const rootsProgress = ref([]);
const rootsLoading = ref(false);
const enqueuingId = ref(null);

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const res = await getReviewStats();
    stats.value = res.data;
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

onMounted(() => {
  fetchStats();
  fetchRootsProgress();
});
</script>
