<template>
  <SuperAdminLoginPanel
    v-if="!isAuthed"
    :password="loginForm.password"
    :loading="loggingIn"
    @update:password="loginForm.password = $event"
    @submit="handleAdminLogin"
  />

  <SuperAdminConsoleLayout v-else :total="total" :disabled-count="disabledCount" @logout="handleLogout">
    <SuperAdminUsersTable
      :users="users"
      :loading="loading"
      :total="total"
      :keyword="keyword"
      :page="page"
      :page-size="pageSize"
      :format-date="formatAdminDate"
      @update:keyword="keyword = $event"
      @update:page="page = $event"
      @update:pageSize="pageSize = $event"
      @search="handleSearch"
      @fetch="fetchUsers"
      @page-size-change="handlePageSizeChange"
      @open-password="openPasswordDialog"
      @toggle-disabled="toggleDisabled"
    />
  </SuperAdminConsoleLayout>

  <SuperAdminPasswordDialog
    :visible="passwordDialogVisible"
    :selected-user="selectedUser"
    :password="passwordForm.password"
    :confirm-password="passwordForm.confirmPassword"
    :saving="savingPassword"
    @update:visible="passwordDialogVisible = $event"
    @update:password="passwordForm.password = $event"
    @update:confirmPassword="passwordForm.confirmPassword = $event"
    @save="handleSavePassword"
  />
</template>

<script setup>
  import { onMounted } from 'vue';
  import SuperAdminConsoleLayout from '../components/admin/SuperAdminConsoleLayout.vue';
  import SuperAdminLoginPanel from '../components/admin/SuperAdminLoginPanel.vue';
  import SuperAdminPasswordDialog from '../components/admin/SuperAdminPasswordDialog.vue';
  import SuperAdminUsersTable from '../components/admin/SuperAdminUsersTable.vue';
  import { formatAdminDate, useAdminConsole } from '../composables/useAdminConsole.js';

  const {
    isAuthed,
    loginForm,
    loggingIn,
    users,
    loading,
    total,
    page,
    pageSize,
    keyword,
    disabledCount,
    passwordDialogVisible,
    selectedUser,
    passwordForm,
    savingPassword,
    loadSession,
    fetchUsers,
    handleAdminLogin,
    handleLogout,
    handleSearch,
    handlePageSizeChange,
    openPasswordDialog,
    handleSavePassword,
    toggleDisabled,
  } = useAdminConsole();

  onMounted(async () => {
    loadSession();
    if (isAuthed.value) {
      await fetchUsers();
    }
  });
</script>