import { createApp } from 'vue';
import {
  ElAlert,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCol,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElLoading,
  ElMain,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElProgress,
  ElRow,
  ElSelect,
  ElSlider,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
} from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router/index.js';
import './styles/main.css';

const app = createApp(App);

[
  ElAlert,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCol,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElProgress,
  ElRow,
  ElSelect,
  ElSlider,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
].forEach((component) => {
  app.component(component.name, component);
});

app.directive('loading', ElLoading.directive);
app.config.globalProperties.$loading = ElLoading.service;
app.use(router);
app.mount('#app');
