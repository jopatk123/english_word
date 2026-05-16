import { createRouter, createWebHistory } from 'vue-router';
import { getAuthRedirectPath } from '../utils/authRouteAccess.js';

const LoginView = () => import('../views/LoginView.vue');
const HomeView = () => import('../views/HomeView.vue');
const RootDetailView = () => import('../views/RootDetailView.vue');
const WordDetailView = () => import('../views/WordDetailView.vue');
const AISettingsView = () => import('../views/AISettingsView.vue');
const AIRootSuggestionView = () => import('../views/AIRootSuggestionView.vue');
const AIWordSuggestionView = () => import('../views/AIWordSuggestionView.vue');
const AIExampleSuggestionView = () => import('../views/AIExampleSuggestionView.vue');
const SearchView = () => import('../views/SearchView.vue');
const StudyDashboardView = () => import('../views/StudyDashboardView.vue');
const StudySessionView = () => import('../views/StudySessionView.vue');
const StudyReportView = () => import('../views/StudyReportView.vue');
const AdminView = () => import('../views/AdminView.vue');

const routes = [
  { path: '/login', name: 'Login', component: LoginView, meta: { guest: true } },
  { path: '/', name: 'Home', component: HomeView },
  { path: '/ai/settings', name: 'AISettings', component: AISettingsView },
  { path: '/ai/roots', name: 'AIRootSuggestion', component: AIRootSuggestionView },
  {
    path: '/root/:id/ai-words',
    name: 'AIWordSuggestion',
    component: AIWordSuggestionView,
    props: true,
  },
  {
    path: '/word/:id/ai-examples',
    name: 'AIExampleSuggestion',
    component: AIExampleSuggestionView,
    props: true,
  },
  { path: '/search', name: 'Search', component: SearchView },
  { path: '/study', name: 'StudyDashboard', component: StudyDashboardView },
  { path: '/study/session', name: 'StudySession', component: StudySessionView },
  { path: '/study/report', name: 'StudyReport', component: StudyReportView },
  { path: '/super-admin', name: 'SuperAdmin', component: AdminView },
  { path: '/root/:id', name: 'RootDetail', component: RootDetailView, props: true },
  { path: '/word/:id', name: 'WordDetail', component: WordDetailView, props: true },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const redirectPath = getAuthRedirectPath(to, token);

  if (redirectPath) {
    next(redirectPath);
    return;
  }

  next();
});

export default router;
