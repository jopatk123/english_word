import { describe, expect, it } from 'vitest';
import { getAuthRedirectPath, isAdminRoutePath } from '../authRouteAccess.js';

describe('authRouteAccess', () => {
  it('会识别超级管理员路由', () => {
    expect(isAdminRoutePath('/super-admin')).toBe(true);
    expect(isAdminRoutePath('/super-admin/users')).toBe(true);
    expect(isAdminRoutePath('/login')).toBe(false);
  });

  it('会把未登录用户重定向到登录页', () => {
    expect(getAuthRedirectPath({ path: '/study', meta: {} }, '')).toBe('/login');
  });

  it('会把已登录用户从 guest 页重定向到首页', () => {
    expect(getAuthRedirectPath({ path: '/login', meta: { guest: true } }, 'token')).toBe('/');
  });

  it('不会干预超级管理员路由', () => {
    expect(getAuthRedirectPath({ path: '/super-admin', meta: {} }, '')).toBe(null);
  });
});