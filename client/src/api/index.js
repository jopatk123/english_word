import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

const aiApi = axios.create({
  baseURL: '/api',
  timeout: 90000,
});

// 请求拦截器 - 添加 token
const addAuthHeader = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthHeader);
aiApi.interceptors.request.use(addAuthHeader);

// 响应拦截器 - 处理 401
const handleResponse = (response) => response.data;
const handleError = (err) => {
  // for most 401 errors we clear auth and redirect to login page
  // but avoid redirecting when user is already trying to log in/register;
  // otherwise the page reloads before our handler can show message
  const status = err.response?.status;
  const url = err.config?.url || '';
  const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
  if (status === 401 && !isAuthEndpoint) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(err);
};

api.interceptors.response.use(handleResponse, handleError);
aiApi.interceptors.response.use(handleResponse, handleError);

// ========== 认证 API ==========
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

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

// ========== 例句 API ==========
export const getExamples = (params) => api.get('/examples', { params });
export const getExample = (id) => api.get(`/examples/${id}`);
export const createExample = (data) => api.post('/examples', data);
export const updateExample = (id, data) => api.put(`/examples/${id}`, data);
export const deleteExample = (id) => api.delete(`/examples/${id}`);

// ========== 背单词 API ==========
const getUserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const getReviewDue = (params = {}) => api.get('/review/due', { params: { tz: getUserTz(), ...params } });
export const getReviewStats = () => api.get('/review/stats', { params: { tz: getUserTz() } });
export const enqueueRoot = (rootId) => api.post('/review/enqueue', { rootId, tz: getUserTz() });
export const submitReviewResult = (wordId, quality) => api.post(`/review/${wordId}/result`, { quality, tz: getUserTz() });
export const getRootsProgress = () => api.get('/review/roots-progress');
export const resetWordReview = (wordId) => api.post(`/review/${wordId}/reset`);
export const removeWordReview = (wordId) => api.delete(`/review/${wordId}`);
export const getQuizChoices = (wordId, count = 3) => api.get(`/review/quiz-choices/${wordId}`, { params: { count } });
export const getReviewHistory = (days = 30) => api.get('/review/history', { params: { tz: getUserTz(), days } });
export const getReviewHistorySummary = (days = 30) => api.get('/review/history/summary', { params: { tz: getUserTz(), days } });
export const exportReviewData = (format = 'json') => api.get('/review/export', { params: { format, tz: getUserTz() } });
export const pauseWordReview = (wordId) => api.post(`/review/${wordId}/pause`);
export const pauseRootReview = (rootId, paused) => api.post(`/review/roots/${rootId}/pause`, { paused });

// ========== AI API ==========
export const testAiConnection = (config) => aiApi.post('/ai/test', { config });
export const getAiRootSuggestions = (config) => aiApi.post('/ai/suggest-roots', { config });
export const getAiWordSuggestions = (rootId, config, options = {}) => aiApi.post('/ai/suggest-words', {
  rootId,
  config,
  excludedWords: options.excludedWords || [],
});
export const getAiExampleSuggestions = (wordId, config, options = {}) => aiApi.post('/ai/suggest-examples', {
  wordId,
  config,
  excludedSentences: options.excludedSentences || [],
});
export const analyzeWord = (word, config, options = {}) => aiApi.post('/ai/analyze-word', {
  word,
  config,
  excludedSentences: options.excludedSentences || [],
  singleExample: Boolean(options.singleExample),
});
export const analyzeSentence = (sentence, config) => aiApi.post('/ai/analyze-sentence', { sentence, config });

export default api;
