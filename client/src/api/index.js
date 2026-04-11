import axios from 'axios';

const createApiClient = (timeout, options = {}) => {
  const { tokenKey = 'token' } = options;
  const client = axios.create({
    baseURL: '/api',
    timeout,
  });

  client.interceptors.request.use((config) => addAuthHeader(config, tokenKey));
  client.interceptors.response.use(handleResponse, handleError);
  return client;
};

// 请求拦截器 - 添加 token
const addAuthHeader = (config, tokenKey = 'token') => {
  const token = localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

// 响应拦截器 - 处理 401
const handleResponse = (response) => response.data;
const handleError = (err) => {
  // for most 401 errors we clear auth and redirect to login page
  // but avoid redirecting when user is already trying to log in/register;
  // otherwise the page reloads before our handler can show message
  const status = err.response?.status;
  const url = err.config?.url || '';
  const isAdminEndpoint = url.includes('/admin/');
  const isAuthEndpoint =
    url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/admin/login');
  if (status === 401 && !isAuthEndpoint) {
    if (isAdminEndpoint) {
      localStorage.removeItem('adminToken');
      window.location.href = '/super-admin';
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }
  return Promise.reject(err);
};

const api = createApiClient(10000, { tokenKey: 'token' });
const adminApi = createApiClient(10000, { tokenKey: 'adminToken' });
// AI 请求通常耗时更长，单独放宽超时时间。
const aiApi = createApiClient(90000);

// ========== 认证 API ==========
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

// ========== 超级管理员 API ==========
export const adminLogin = (data) => adminApi.post('/admin/login', data);
export const getAdminUsers = (params) => adminApi.get('/admin/users', { params });
export const updateAdminUserPassword = (id, data) => adminApi.put(`/admin/users/${id}/password`, data);
export const setAdminUserDisabled = (id, disabled) =>
  adminApi.put(`/admin/users/${id}/status`, { disabled });

// ========== 词根 API ==========
export const getRoots = (keyword) => api.get('/roots', { params: { keyword } });
export const getRoot = (id) => api.get(`/roots/${id}`);
export const getDefaultRoot = () => api.get('/roots/default');
export const createRoot = (data) => api.post('/roots', data);
export const updateRoot = (id, data) => api.put(`/roots/${id}`, data);
export const deleteRoot = (id) => api.delete(`/roots/${id}`);

// ========== 单词 API ==========
export const getWords = (params) => api.get('/words', { params });
export const getWord = (id) => api.get(`/words/${id}`);
export const createWord = (data) => api.post('/words', data);
export const updateWord = (id, data) => api.put(`/words/${id}`, data);
export const deleteWord = (id) => api.delete(`/words/${id}`);
export const moveWord = (id, fromRootId, toRootId) =>
  api.put(`/words/${id}/move`, { fromRootId, toRootId });

// ========== 例句 API ==========
export const getExamples = (params) => api.get('/examples', { params });
export const getExample = (id) => api.get(`/examples/${id}`);
export const createExample = (data) => api.post('/examples', data);
export const updateExample = (id, data) => api.put(`/examples/${id}`, data);
export const deleteExample = (id) => api.delete(`/examples/${id}`);

// ========== 背单词 API ==========
const getUserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const getReviewDue = (params = {}) =>
  api.get('/review/due', { params: { tz: getUserTz(), ...params } });
export const getReviewStats = () => api.get('/review/stats', { params: { tz: getUserTz() } });
export const enqueueRoot = (rootId) => api.post('/review/enqueue', { rootId, tz: getUserTz() });
export const submitReviewResult = (wordId, quality) =>
  api.post(`/review/${wordId}/result`, { quality, tz: getUserTz() });
export const getRootsProgress = () => api.get('/review/roots-progress');
export const resetWordReview = (wordId) => api.post(`/review/${wordId}/reset`, { tz: getUserTz() });
export const removeWordReview = (wordId) => api.delete(`/review/${wordId}`);
export const getQuizChoices = (wordId, count = 3) =>
  api.get(`/review/quiz-choices/${wordId}`, { params: { count } });
export const getReviewHistory = (days = 30) =>
  api.get('/review/history', { params: { tz: getUserTz(), days } });
export const getReviewHistorySummary = (days = 30) =>
  api.get('/review/history/summary', { params: { tz: getUserTz(), days } });
export const exportReviewData = (format = 'json') =>
  api.get('/review/export', { params: { format, tz: getUserTz() } });
export const exportAllData = () => api.get('/review/data/export');
export const importAllData = (data) => api.post('/review/data/import', data);
export const pauseWordReview = (wordId) => api.post(`/review/${wordId}/pause`);
export const pauseRootReview = (rootId, paused) =>
  api.post(`/review/roots/${rootId}/pause`, { paused });

// ========== AI API ==========
export const testAiConnection = (config) => aiApi.post('/ai/test', { config });
export const getAiRootSuggestions = (config) => aiApi.post('/ai/suggest-roots', { config });
export const getAiWordSuggestions = (rootId, config, options = {}) =>
  aiApi.post('/ai/suggest-words', {
    rootId,
    config,
    excludedWords: options.excludedWords || [],
  });
export const getAiExampleSuggestions = (wordId, config, options = {}) =>
  aiApi.post('/ai/suggest-examples', {
    wordId,
    config,
    excludedSentences: options.excludedSentences || [],
  });
export const analyzeWord = (word, config, options = {}) =>
  aiApi.post('/ai/analyze-word', {
    word,
    config,
    excludedSentences: options.excludedSentences || [],
    singleExample: Boolean(options.singleExample),
  });
export const analyzeSentence = (sentence, config) =>
  aiApi.post('/ai/analyze-sentence', { sentence, config });

// ========== 学习计时 API ==========
export const startStudySession = (note = '') => api.post('/study-sessions/start', { note });
export const endStudySession = (id) => api.post(`/study-sessions/${id}/end`);
export const getStudySessionStats = () => api.get('/study-sessions/stats');
export const exportStudySessions = () => api.get('/study-sessions/export', { responseType: 'blob' });

export default api;
