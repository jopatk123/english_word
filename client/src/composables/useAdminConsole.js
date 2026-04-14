import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  adminLogin,
  getAdminUsers,
  setAdminUserDisabled,
  updateAdminUserPassword,
} from '../api/index.js';
import { notifyAdminSessionChanged, subscribeAdminSessionChanges } from '../utils/authSync.js';

export const formatAdminDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const useAdminConsole = () => {
  const adminToken = ref(localStorage.getItem('adminToken') || '');
  const isAuthed = computed(() => Boolean(adminToken.value));

  const loginForm = ref({ password: '' });
  const loggingIn = ref(false);

  const users = ref([]);
  const loading = ref(false);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(10);
  const keyword = ref('');

  const disabledCount = computed(() => users.value.filter((user) => user.isDisabled).length);

  const passwordDialogVisible = ref(false);
  const selectedUser = ref(null);
  const passwordForm = ref({ password: '', confirmPassword: '' });
  const savingPassword = ref(false);

  const resetConsoleState = () => {
    users.value = [];
    total.value = 0;
    page.value = 1;
    keyword.value = '';
  };

  const loadSession = () => {
    adminToken.value = localStorage.getItem('adminToken') || '';
  };

  const fetchUsers = async () => {
    if (!isAuthed.value) return;
    loading.value = true;
    try {
      const res = await getAdminUsers({
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value.trim(),
      });
      users.value = Array.isArray(res.data) ? res.data : [];
      total.value = Number.isFinite(res.total) ? res.total : 0;
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '获取用户列表失败');
    } finally {
      loading.value = false;
    }
  };

  const handleAdminLogin = async () => {
    if (!loginForm.value.password) {
      return ElMessage.warning('请输入管理员密码');
    }
    loggingIn.value = true;
    try {
      const res = await adminLogin({ password: loginForm.value.password });
      localStorage.setItem('adminToken', res.data.token);
      notifyAdminSessionChanged({ type: 'login' });
      loadSession();
      loginForm.value.password = '';
      ElMessage.success('管理员登录成功');
      await fetchUsers();
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '管理员登录失败');
    } finally {
      loggingIn.value = false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    notifyAdminSessionChanged({ type: 'logout' });
    loadSession();
    resetConsoleState();
  };

  const bindSessionSync = () =>
    subscribeAdminSessionChanges(async () => {
      loadSession();
      if (isAuthed.value) {
        await fetchUsers();
        return;
      }

      resetConsoleState();
    });

  const handleSearch = async () => {
    page.value = 1;
    await fetchUsers();
  };

  const handlePageSizeChange = async (size) => {
    pageSize.value = size;
    page.value = 1;
    await fetchUsers();
  };

  const openPasswordDialog = (user) => {
    selectedUser.value = user;
    passwordForm.value = { password: '', confirmPassword: '' };
    passwordDialogVisible.value = true;
  };

  const handleSavePassword = async () => {
    if (!passwordForm.value.password) {
      return ElMessage.warning('请输入新密码');
    }
    if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
      return ElMessage.warning('两次输入的密码不一致');
    }
    savingPassword.value = true;
    try {
      await updateAdminUserPassword(selectedUser.value.id, {
        password: passwordForm.value.password,
      });
      ElMessage.success('密码已更新');
      passwordDialogVisible.value = false;
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '更新密码失败');
    } finally {
      savingPassword.value = false;
    }
  };

  const toggleDisabled = async (user) => {
    const nextDisabled = !user.isDisabled;
    try {
      await ElMessageBox.confirm(
        nextDisabled
          ? `确定禁用用户「${user.username}」的登录吗？禁用后该用户无法登录，直到重新启用。`
          : `确定恢复用户「${user.username}」的登录权限吗？`,
        '操作确认',
        {
          type: 'warning',
          confirmButtonText: '确认',
          cancelButtonText: '取消',
        }
      );
      await setAdminUserDisabled(user.id, nextDisabled);
      user.isDisabled = nextDisabled;
      ElMessage.success(nextDisabled ? '已禁用登录' : '已启用登录');
    } catch {
      // 用户取消操作，不需要处理
    }
  };

  return {
    adminToken,
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
    bindSessionSync,
    handleSearch,
    handlePageSizeChange,
    openPasswordDialog,
    handleSavePassword,
    toggleDisabled,
  };
};
