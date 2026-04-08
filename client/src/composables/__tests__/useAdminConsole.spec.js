import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminLoginMock = vi.fn();
const getAdminUsersMock = vi.fn();
const setAdminUserDisabledMock = vi.fn();
const updateAdminUserPasswordMock = vi.fn();

vi.mock('../../api/index.js', () => ({
  adminLogin: (...args) => adminLoginMock(...args),
  getAdminUsers: (...args) => getAdminUsersMock(...args),
  setAdminUserDisabled: (...args) => setAdminUserDisabledMock(...args),
  updateAdminUserPassword: (...args) => updateAdminUserPasswordMock(...args),
}));

const elMessage = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};
const confirmMock = vi.fn();

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: {
    confirm: (...args) => confirmMock(...args),
  },
}));

const { useAdminConsole } = await import('../useAdminConsole.js');

const makeLocalStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    _reset: () => {
      store = {};
    },
  };
};

const localStorageMock = makeLocalStorageMock();

describe('useAdminConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock._reset();
  });

  it('fetchUsers 正确读取列表响应中的 data 和 total', async () => {
    localStorage.setItem('adminToken', 'admin-token');
    getAdminUsersMock.mockResolvedValue({
      data: [{ id: 1, username: 'alice', isDisabled: false }],
      total: 1,
    });

    const admin = useAdminConsole();
    await admin.fetchUsers();

    expect(admin.users.value).toEqual([{ id: 1, username: 'alice', isDisabled: false }]);
    expect(admin.total.value).toBe(1);
  });

  it('管理员登录后保存 token 并刷新用户列表', async () => {
    adminLoginMock.mockResolvedValue({
      data: { token: 'new-admin-token' },
    });
    getAdminUsersMock.mockResolvedValue({ data: [], total: 0 });

    const admin = useAdminConsole();
    admin.loginForm.value.password = 'secret';

    await admin.handleAdminLogin();

    expect(localStorage.getItem('adminToken')).toBe('new-admin-token');
    expect(admin.loginForm.value.password).toBe('');
    expect(getAdminUsersMock).toHaveBeenCalledTimes(1);
  });

  it('退出管理时清空 token 和本地列表状态', () => {
    localStorage.setItem('adminToken', 'token');
    const admin = useAdminConsole();

    admin.users.value = [{ id: 1, username: 'alice' }];
    admin.total.value = 9;
    admin.keyword.value = 'alice';

    admin.handleLogout();

    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(admin.users.value).toEqual([]);
    expect(admin.total.value).toBe(0);
    expect(admin.keyword.value).toBe('');
    expect(admin.page.value).toBe(1);
  });
});