import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

const aiApi = axios.create({
  baseURL: '/api',
  timeout: 90000,
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (err) => Promise.reject(err),
);

aiApi.interceptors.response.use(
  (response) => response.data,
  (err) => Promise.reject(err),
);

// ========== 词根 API ==========
export const getRoots = (keyword) => api.get('/roots', { params: { keyword } });
export const getRoot = (id) => api.get(`/roots/${id}`);
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

// ========== AI API ==========
export const testAiConnection = (config) => aiApi.post('/ai/test', { config });
export const getAiRootSuggestions = (config) => aiApi.post('/ai/suggest-roots', { config });
export const getAiWordSuggestions = (rootId, config) => aiApi.post('/ai/suggest-words', { rootId, config });
export const getAiExampleSuggestions = (wordId, config) => aiApi.post('/ai/suggest-examples', { wordId, config });

export default api;
