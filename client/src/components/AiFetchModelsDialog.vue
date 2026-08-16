<template>
  <el-dialog
    :model-value="modelValue"
    title="自动获取模型"
    width="520px"
    @update:model-value="$emit('update:modelValue', $event)"
    @closed="$emit('closed')"
  >
    <el-input
      :model-value="search"
      placeholder="搜索模型名称..."
      clearable
      style="margin-bottom: 12px"
      @update:model-value="$emit('update:search', $event)"
    />
    <div v-if="fetching" class="fetch-models-loading">正在拉取模型列表...</div>
    <div v-else class="fetch-models-list">
      <el-checkbox
        v-for="model in models"
        :key="model.name"
        :model-value="selected.includes(model.name)"
        :disabled="model.exists"
        class="fetch-model-item"
        @change="(checked) => $emit('toggle', model.name, checked)"
      >
        {{ model.name }}
        <el-tag v-if="model.exists" size="small" type="info">已添加</el-tag>
      </el-checkbox>
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected.length || fetching" @click="$emit('confirm')">
        导入({{ selected.length }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
  defineProps({
    modelValue: { type: Boolean, default: false },
    fetching: { type: Boolean, default: false },
    search: { type: String, default: '' },
    models: { type: Array, default: () => [] },
    selected: { type: Array, default: () => [] },
  });

  defineEmits(['update:modelValue', 'update:search', 'toggle', 'confirm', 'closed']);
</script>

<style scoped>
  .fetch-models-loading {
    text-align: center;
    padding: 24px;
    color: #909399;
  }

  .fetch-models-list {
    max-height: 360px;
    overflow-y: auto;
  }

  .fetch-model-item {
    display: block;
    padding: 4px 0;
  }
</style>
