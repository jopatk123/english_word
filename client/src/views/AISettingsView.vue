<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>AI 配置</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="ai-card">
      <template #header>
        <div class="page-heading">
          <div>
            <h2>AI 配置</h2>
            <p>API Key 只保存在当前浏览器的本地存储中，不会写入数据库。</p>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="96px" class="ai-form">
        <el-form-item label="厂商">
          <el-select v-model="form.providerId" placeholder="请选择厂商" @change="handleProviderChange">
            <el-option
              v-for="provider in providers"
              :key="provider.id"
              :label="provider.name"
              :value="provider.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Base URL">
          <el-input v-model="form.baseUrl" placeholder="请输入 Base URL" />
        </el-form-item>

        <el-form-item label="模型">
          <el-select v-model="form.model" placeholder="请选择模型">
            <el-option
              v-for="model in currentProvider.models"
              :key="model"
              :label="model"
              :value="model"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input v-model="form.apiKey" show-password placeholder="请输入 API Key" />
        </el-form-item>

        <el-form-item>
          <div class="page-actions">
            <el-button type="primary" :loading="saving" @click="handleSave">保存到本地</el-button>
            <el-button :loading="testing" @click="handleTest">测试连接</el-button>
            <el-button @click="$router.push('/')">返回首页</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="ai-card ai-summary-card">
      <template #header>
        <span>当前配置摘要</span>
      </template>
      <div class="summary-grid">
        <div>
          <span class="summary-label">厂商</span>
          <strong>{{ currentProvider.name }}</strong>
        </div>
        <div>
          <span class="summary-label">模型</span>
          <strong>{{ form.model || '-' }}</strong>
        </div>
        <div>
          <span class="summary-label">Base URL</span>
          <strong>{{ form.baseUrl || '-' }}</strong>
        </div>
        <div>
          <span class="summary-label">API Key</span>
          <strong>{{ maskedKey }}</strong>
        </div>
      </div>
    </el-card>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { testAiConnection } from '../api/index.js';
import { AI_PROVIDERS, getProviderById } from '../constants/aiProviders.js';
import { loadAiSettings, maskApiKey, saveAiSettings } from '../utils/aiSettings.js';

const providers = AI_PROVIDERS;
const form = ref(loadAiSettings());
const saving = ref(false);
const testing = ref(false);

const currentProvider = computed(() => getProviderById(form.value.providerId));
const maskedKey = computed(() => maskApiKey(form.value.apiKey));

const handleProviderChange = (providerId) => {
  const provider = getProviderById(providerId);
  form.value.providerType = provider.providerType;
  form.value.baseUrl = provider.baseUrl;
  form.value.model = provider.models[0];
};

const handleSave = async () => {
  if (!form.value.baseUrl || !form.value.model || !form.value.apiKey) {
    return ElMessage.warning('请先完整填写 Base URL、模型和 API Key');
  }

  saving.value = true;
  try {
    form.value = saveAiSettings(form.value);
    ElMessage.success('AI 配置已保存到本地');
  } finally {
    saving.value = false;
  }
};

const handleTest = async () => {
  if (!form.value.baseUrl || !form.value.model || !form.value.apiKey) {
    return ElMessage.warning('请先完整填写 Base URL、模型和 API Key');
  }

  testing.value = true;
  try {
    const normalized = saveAiSettings(form.value);
    form.value = normalized;
    await testAiConnection(normalized);
    ElMessage.success('AI 连接测试成功');
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || (e?.code === 'ECONNABORTED' ? 'AI 请求超时，请稍后重试' : 'AI 连接测试失败'));
  } finally {
    testing.value = false;
  }
};
</script>