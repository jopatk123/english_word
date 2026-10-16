<template>
  <div class="passage-page">
    <div class="passage-list-header">
      <div>
        <h2>📖 短文阅读</h2>
        <p>粘贴或用 AI 生成英文短文，边读边点词查义，逐句听读。</p>
      </div>
      <el-button type="primary" @click="$router.push('/reading/new')">新建短文</el-button>
    </div>

    <button
      v-if="dueCount > 0 && filters.status !== 'due'"
      type="button"
      class="passage-due-banner"
      @click="applyFilter({ status: 'due' })"
    >
      今日有 <strong>{{ dueCount }}</strong> 篇短文待重读，点击查看
    </button>

    <div class="passage-filters">
      <el-input
        v-model="keywordInput"
        class="passage-filter-keyword"
        placeholder="搜索标题或正文"
        clearable
        @keyup.enter="applyFilter({ keyword: keywordInput })"
        @clear="applyFilter({ keyword: '' })"
      />
      <el-select
        :model-value="filters.status"
        class="passage-filter-select"
        placeholder="全部状态"
        clearable
        @update:model-value="(value) => applyFilter({ status: value || '' })"
      >
        <el-option
          v-for="option in PASSAGE_STATUS_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        :model-value="filters.level"
        class="passage-filter-select"
        placeholder="全部难度"
        clearable
        @update:model-value="(value) => applyFilter({ level: value || '' })"
      >
        <el-option v-for="level in PASSAGE_LEVELS" :key="level" :label="level" :value="level" />
      </el-select>
    </div>

    <div v-loading="loading" class="passage-card-list">
      <el-empty
        v-if="!loading && passages.length === 0"
        :description="hasFilters ? '没有符合条件的短文' : '还没有短文'"
      >
        <el-button v-if="!hasFilters" type="primary" @click="$router.push('/reading/new')">
          添加第一篇短文
        </el-button>
      </el-empty>

      <article
        v-for="passage in passages"
        :key="passage.id"
        class="passage-card"
        @click="$router.push(`/reading/${passage.id}`)"
      >
        <div class="passage-card-title">
          <strong>{{ passage.title }}</strong>
          <el-tag v-if="passage.level" size="small" effect="plain">{{ passage.level }}</el-tag>
          <el-tag v-if="passage.source === 'ai'" size="small" type="info">AI</el-tag>
          <el-tag size="small" :type="statusOf(passage).tagType">
            {{ statusOf(passage).label }}
          </el-tag>
        </div>
        <p class="passage-card-excerpt">{{ passage.excerpt }}</p>
        <div class="passage-card-footer">
          <span class="passage-card-meta">
            {{ passage.wordCount }} 词 · {{ passage.sentenceCount }} 句
            <template v-if="passage.review">
              · 已读 {{ passage.review.readCount }} 次 · 下次重读 {{ passage.review.dueDate }}
            </template>
          </span>
          <span class="passage-card-actions" @click.stop>
            <el-button link type="primary" @click="$router.push(`/reading/${passage.id}/edit`)">
              编辑
            </el-button>
            <el-popconfirm
              title="确定删除这篇短文吗？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="handleDelete(passage)"
            >
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </span>
        </div>
      </article>
    </div>

    <el-pagination
      v-if="total > pageSize"
      class="passage-pagination"
      layout="prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="filters.page"
      @current-change="(page) => applyFilter({ page }, { keepPage: true })"
    />
  </div>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import { deletePassage, getPassageDueCount, getPassages } from '../api/index.js';
  import {
    PASSAGE_LEVELS,
    PASSAGE_STATUS_MAP,
    PASSAGE_STATUS_OPTIONS,
  } from '../constants/passage.js';

  const pageSize = 20;
  const route = useRoute();
  const router = useRouter();

  const passages = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const dueCount = ref(0);

  const readQuery = (query) => ({
    keyword: typeof query.keyword === 'string' ? query.keyword : '',
    status: PASSAGE_STATUS_MAP[query.status] ? query.status : '',
    level: PASSAGE_LEVELS.includes(query.level) ? query.level : '',
    page: Math.max(parseInt(query.page) || 1, 1),
  });

  const filters = computed(() => readQuery(route.query));
  const keywordInput = ref(filters.value.keyword);
  const hasFilters = computed(() =>
    Boolean(filters.value.keyword || filters.value.status || filters.value.level)
  );

  const statusOf = (passage) => PASSAGE_STATUS_MAP[passage.status] || PASSAGE_STATUS_MAP.unread;

  const applyFilter = (patch, { keepPage = false } = {}) => {
    const next = { ...filters.value, ...patch };
    if (!keepPage) next.page = 1;
    const query = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value && !(key === 'page' && value === 1))
    );
    router.replace({ path: '/reading', query });
  };

  const fetchPassages = async () => {
    loading.value = true;
    try {
      const { keyword, status, level, page } = filters.value;
      const res = await getPassages({
        page,
        pageSize,
        ...(keyword ? { keyword } : {}),
        ...(status ? { status } : {}),
        ...(level ? { level } : {}),
      });
      passages.value = res.data;
      total.value = res.total;
    } catch {
      ElMessage.error('获取短文列表失败');
    } finally {
      loading.value = false;
    }
  };

  const fetchDueCount = async () => {
    try {
      const res = await getPassageDueCount();
      dueCount.value = res.data.count;
    } catch {
      dueCount.value = 0;
    }
  };

  const handleDelete = async (passage) => {
    try {
      await deletePassage(passage.id);
      ElMessage.success('已删除');
      if (passages.value.length === 1 && filters.value.page > 1) {
        applyFilter({ page: filters.value.page - 1 }, { keepPage: true });
      } else {
        fetchPassages();
      }
      fetchDueCount();
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '删除失败');
    }
  };

  watch(
    () => route.query,
    () => {
      if (route.path !== '/reading') return;
      keywordInput.value = filters.value.keyword;
      fetchPassages();
    }
  );

  onMounted(() => {
    fetchPassages();
    fetchDueCount();
  });
</script>
