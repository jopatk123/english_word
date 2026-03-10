import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import RootDetailView from '../views/RootDetailView.vue';
import WordDetailView from '../views/WordDetailView.vue';
import AISettingsView from '../views/AISettingsView.vue';
import AIRootSuggestionView from '../views/AIRootSuggestionView.vue';
import AIWordSuggestionView from '../views/AIWordSuggestionView.vue';
import AIExampleSuggestionView from '../views/AIExampleSuggestionView.vue';

const routes = [
  { path: '/login', name: 'Login', component: LoginView, meta: { guest: true } },
  { path: '/', name: 'Home', component: HomeView },
  { path: '/ai/settings', name: 'AISettings', component: AISettingsView },
  { path: '/ai/roots', name: 'AIRootSuggestion', component: AIRootSuggestionView },
  { path: '/root/:id/ai-words', name: 'AIWordSuggestion', component: AIWordSuggestionView, props: true },
  { path: '/word/:id/ai-examples', name: 'AIExampleSuggestion', component: AIExampleSuggestionView, props: true },
  { path: '/root/:id', name: 'RootDetail', component: RootDetailView, props: true },
  { path: '/word/:id', name: 'WordDetail', component: WordDetailView, props: true },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (!token && !to.meta.guest) {
    next('/login');
  } else if (token && to.meta.guest) {
    next('/');
  } else {
    next();
  }
});

export default router;
