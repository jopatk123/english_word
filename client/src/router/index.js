import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import RootDetailView from '../views/RootDetailView.vue';
import WordDetailView from '../views/WordDetailView.vue';
import AISettingsView from '../views/AISettingsView.vue';
import AIRootSuggestionView from '../views/AIRootSuggestionView.vue';
import AIWordSuggestionView from '../views/AIWordSuggestionView.vue';
import AIExampleSuggestionView from '../views/AIExampleSuggestionView.vue';
import SearchView from '../views/SearchView.vue';
import StudyDashboardView from '../views/StudyDashboardView.vue';
import StudySessionView from '../views/StudySessionView.vue';
import StudyReportView from '../views/StudyReportView.vue';
import AdminView from '../views/AdminView.vue';
import { getAuthRedirectPath } from '../utils/authRouteAccess.js';

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
