export const isAdminRoutePath = (path = '') => typeof path === 'string' && path.startsWith('/super-admin');

export const getAuthRedirectPath = (route, token) => {
  const path = route?.path || '';

  if (isAdminRoutePath(path)) {
    return null;
  }

  if (!token && !route?.meta?.guest) {
    return '/login';
  }

  if (token && route?.meta?.guest) {
    return '/';
  }

  return null;
};