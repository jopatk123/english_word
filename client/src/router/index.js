import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RootDetailView from '../views/RootDetailView.vue';
import WordDetailView from '../views/WordDetailView.vue';

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/root/:id', name: 'RootDetail', component: RootDetailView, props: true },
  { path: '/word/:id', name: 'WordDetail', component: WordDetailView, props: true },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
