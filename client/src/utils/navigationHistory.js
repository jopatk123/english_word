const STORAGE_KEY = 'english-word-route-sources';
const MAX_SOURCES = 30;

let routeSources;

const ROUTE_LABELS = {
  Login: '登录',
  Home: '首页',
  AISettings: 'AI 配置',
  AIRootSuggestion: '智能添加词根',
  AIWordSuggestion: '智能添加单词',
  AIExampleSuggestion: '智能添加例句',
  Search: '搜索',
  StudyDashboard: '背单词',
  StudySession: '学习中',
  StudyReport: '学习报表',
  SuperAdmin: '超级管理员',
  RootDetail: '词根详情',
  WordDetail: '单词详情',
};

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    return null;
  }

  return null;
};

const loadRouteSources = () => {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistRouteSources = () => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(routeSources));
  } catch {
    // Ignore storage failures so navigation still works in memory.
  }
};

const ensureRouteSources = () => {
  if (!routeSources) {
    routeSources = loadRouteSources();
  }

  return routeSources;
};

const normalizeRoute = (route) => {
  if (!route?.name || !route?.fullPath) {
    return null;
  }

  return {
    name: String(route.name),
    fullPath: route.fullPath,
    path: route.path || route.fullPath,
    params: route.params || {},
    query: route.query || {},
    hash: route.hash || '',
  };
};

const pruneRouteSources = (sources) => {
  const entries = Object.entries(sources);
  if (entries.length <= MAX_SOURCES) {
    return sources;
  }

  entries.sort(([, left], [, right]) => (left.savedAt || 0) - (right.savedAt || 0));
  const nextSources = { ...sources };

  while (entries.length > MAX_SOURCES) {
    const [oldestKey] = entries.shift();
    delete nextSources[oldestKey];
  }

  return nextSources;
};

export const rememberRouteSource = (to, from) => {
  const target = normalizeRoute(to);
  const source = normalizeRoute(from);
  if (!target || !source || target.fullPath === source.fullPath) {
    return;
  }

  routeSources = pruneRouteSources({
    ...ensureRouteSources(),
    [target.fullPath]: {
      ...source,
      savedAt: Date.now(),
    },
  });
  persistRouteSources();
};

export const getRouteSource = (fullPath) => {
  if (!fullPath) {
    return null;
  }

  return ensureRouteSources()[fullPath] || null;
};

export const getRouteDisplayLabel = (route, options = {}) => {
  if (!route?.name) {
    return options.fallbackLabel || '上一步';
  }

  if (route.name === 'RootDetail' && options.rootName) {
    return `词根：${options.rootName}`;
  }

  return ROUTE_LABELS[route.name] || options.fallbackLabel || '上一步';
};

export const clearRouteSourcesForTest = () => {
  routeSources = {};
  const storage = getStorage();
  storage?.removeItem(STORAGE_KEY);
};