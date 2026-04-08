<template>
  <div class="sa-search-bar">
    <el-input
      :model-value="keyword"
      clearable
      size="large"
      placeholder="搜索用户名…"
      class="sa-search-input"
      @update:model-value="$emit('update:keyword', $event)"
      @clear="$emit('search')"
      @keyup.enter="$emit('search')"
    />
    <el-button type="primary" size="large" @click="$emit('search')">搜索</el-button>
  </div>

  <div class="sa-table-wrap">
    <el-table
      :data="users"
      v-loading="loading"
      stripe
      empty-text="暂无用户数据"
      class="sa-table"
    >
      <el-table-column prop="id" label="ID" width="72" align="center" />
      <el-table-column prop="username" label="用户名" min-width="180" />
      <el-table-column label="登录状态" width="110" align="center">
        <template #default="{ row }">
          <span :class="['sa-status-badge', row.isDisabled ? 'sa-status-disabled' : 'sa-status-active']">
            {{ row.isDisabled ? '已禁用' : '可登录' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="172">
        <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
      </el-table-column>
      <el-table-column label="最近更新" min-width="172">
        <template #default="{ row }">{{ formatDate(row.update_time) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <button class="sa-action-btn" @click="$emit('open-password', row)">改密码</button>
          <button
            :class="['sa-action-btn', row.isDisabled ? 'sa-action-enable' : 'sa-action-disable']"
            @click="$emit('toggle-disabled', row)"
          >
            {{ row.isDisabled ? '启用' : '禁用' }}
          </button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <div class="sa-pagination">
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      background
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      @update:current-page="$emit('update:page', $event)"
      @update:page-size="$emit('update:pageSize', $event)"
      @current-change="$emit('fetch')"
      @size-change="$emit('page-size-change', $event)"
    />
  </div>
</template>

<script setup>
  defineProps({
    users: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    total: {
      type: Number,
      default: 0,
    },
    keyword: {
      type: String,
      default: '',
    },
    page: {
      type: Number,
      default: 1,
    },
    pageSize: {
      type: Number,
      default: 10,
    },
    formatDate: {
      type: Function,
      required: true,
    },
  });

  defineEmits([
    'update:keyword',
    'update:page',
    'update:pageSize',
    'search',
    'fetch',
    'page-size-change',
    'open-password',
    'toggle-disabled',
  ]);
</script>

<style scoped>
  .sa-search-bar {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .sa-search-input {
    width: 320px;
  }

  .sa-table-wrap {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }

  .sa-table {
    width: 100%;
  }

  .sa-status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sa-status-active {
    background: #dcfce7;
    color: #166534;
  }

  .sa-status-disabled {
    background: #fee2e2;
    color: #991b1b;
  }

  .sa-action-btn {
    padding: 4px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    margin: 0 3px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .sa-action-btn:hover {
    background: #e0e7ff;
    border-color: #818cf8;
    color: #4338ca;
  }

  .sa-action-disable {
    border-color: #fecaca;
    color: #b91c1c;
    background: #fff5f5;
  }

  .sa-action-disable:hover {
    background: #fee2e2;
    border-color: #f87171;
    color: #7f1d1d;
  }

  .sa-action-enable {
    border-color: #bbf7d0;
    color: #15803d;
    background: #f0fdf4;
  }

  .sa-action-enable:hover {
    background: #dcfce7;
    border-color: #4ade80;
    color: #14532d;
  }

  .sa-pagination {
    display: flex;
    justify-content: flex-end;
    padding: 4px 0;
  }

  @media (max-width: 900px) {
    .sa-search-input {
      flex: 1;
      width: auto;
    }
  }
</style>