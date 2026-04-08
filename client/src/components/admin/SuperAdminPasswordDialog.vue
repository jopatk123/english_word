<template>
  <el-dialog
    :model-value="visible"
    title="修改用户密码"
    width="480px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="目标用户">
        <el-input :model-value="selectedUser?.username || ''" disabled />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input
          :model-value="password"
          type="password"
          show-password
          placeholder="请输入新密码（至少6位）"
          @update:model-value="$emit('update:password', $event)"
        />
      </el-form-item>
      <el-form-item label="确认密码">
        <el-input
          :model-value="confirmPassword"
          type="password"
          show-password
          placeholder="再次输入新密码"
          @update:model-value="$emit('update:confirmPassword', $event)"
          @keyup.enter="$emit('save')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="$emit('save')">保存密码</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
  defineProps({
    visible: {
      type: Boolean,
      default: false,
    },
    selectedUser: {
      type: Object,
      default: null,
    },
    password: {
      type: String,
      default: '',
    },
    confirmPassword: {
      type: String,
      default: '',
    },
    saving: {
      type: Boolean,
      default: false,
    },
  });

  defineEmits(['update:visible', 'update:password', 'update:confirmPassword', 'save']);
</script>