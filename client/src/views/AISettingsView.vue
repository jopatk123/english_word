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
            <p>API Key 只保存在当前浏览器的本地存储中，不会写入数据库。您可以为不同的 AI 厂商分别配置不同的 API Key，切换厂商时会自动加载已保存的 Key。</p>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="96px" class="ai-form">
        <!-- 厂商选择 -->
        <el-form-item label="厂商">
          <div class="field-row">
            <el-select v-model="form.providerId" placeholder="请选择厂商" @change="handleProviderChange">
              <el-option-group label="内置厂商">
                <el-option
                  v-for="provider in builtInProviders"
                  :key="provider.id"
                  :label="provider.name"
                  :value="provider.id"
                />
              </el-option-group>
              <el-option-group v-if="customProviderList.length" label="自定义厂商">
                <el-option
                  v-for="provider in customProviderList"
                  :key="provider.id"
                  :label="provider.name"
                  :value="provider.id"
                />
              </el-option-group>
            </el-select>
            <el-button link type="primary" @click="showAddProvider = true">+ 新增厂商</el-button>
            <el-button
              v-if="isCustomProvider"
              link
              type="danger"
              @click="handleDeleteProvider"
            >删除此厂商</el-button>
          </div>
        </el-form-item>

        <el-form-item label="Base URL">
          <el-input v-model="form.baseUrl" placeholder="请输入 Base URL" />
        </el-form-item>

        <!-- 模型选择 -->
        <el-form-item label="模型">
          <div class="field-row">
            <el-select v-model="form.model" placeholder="请选择模型">
              <el-option-group v-if="builtInModels.length" label="标准模型">
                <el-option v-for="model in builtInModels" :key="model" :label="model" :value="model" />
              </el-option-group>
              <el-option-group v-if="customModelsForProvider.length" label="自定义模型">
                <el-option v-for="model in customModelsForProvider" :key="model" :label="model" :value="model" />
              </el-option-group>
            </el-select>
            <el-button link type="primary" @click="showAddModel = true">+ 新增模型</el-button>
          </div>
          <!-- 自定义模型标签（可删除） -->
          <div v-if="customModelsForProvider.length" class="custom-tags">
            <el-tag
              v-for="model in customModelsForProvider"
              :key="model"
              closable
              type="info"
              size="small"
              @close="handleDeleteModel(model)"
            >{{ model }}</el-tag>
          </div>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input v-model="form.apiKey" show-password placeholder="请输入 API Key" />
        </el-form-item>

        <el-form-item label="Temperature">
          <div class="temperature-row">
            <el-slider
              v-model="form.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              :marks="{ 0: '0', 0.2: '0.2', 1: '1', 2: '2' }"
              show-stops
              style="flex: 1"
            />
            <el-input-number
              v-model="form.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              :precision="1"
              controls-position="right"
              style="width: 100px; margin-left: 16px"
            />
          </div>
          <div class="temperature-hint">较低值（如 0.2）输出更稳定；较高值（如 1.0）输出更有创意</div>
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
        <div>
          <span class="summary-label">Temperature</span>
          <strong>{{ form.temperature ?? 0.2 }}</strong>
        </div>
      </div>
    </el-card>

    <!-- 新增自定义厂商对话框 -->
    <el-dialog v-model="showAddProvider" title="新增自定义厂商" width="480px" @closed="resetAddProviderForm">
      <el-form :model="addProviderForm" label-width="90px">
        <el-form-item label="厂商名称" required>
          <el-input v-model="addProviderForm.name" placeholder="如：My LLM Server" />
        </el-form-item>
        <el-form-item label="Base URL" required>
          <el-input v-model="addProviderForm.baseUrl" placeholder="如：http://localhost:11434/v1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProvider = false">取消</el-button>
        <el-button type="primary" :loading="savingProvider" @click="handleAddProvider">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增自定义模型对话框 -->
    <el-dialog v-model="showAddModel" title="新增自定义模型" width="400px" @closed="newModelName = ''">
      <el-form label-width="80px">
        <el-form-item label="模型名称" required>
          <el-input
            v-model="newModelName"
            placeholder="如：llama3:8b 或 gpt-4-turbo"
            @keyup.enter="handleAddModel"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddModel = false">取消</el-button>
        <el-button type="primary" @click="handleAddModel">添加</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { testAiConnection } from '../api/index.js';
import { AI_PROVIDERS } from '../constants/aiProviders.js';
import {
  loadAiSettings, maskApiKey, saveAiSettings, setCurrentProviderId, loadProviderSettings,
  getAllProviders, getAllModels, getCustomModels, getCustomProviders,
  saveCustomProvider, deleteCustomProvider, addCustomModel, deleteCustomModel,
} from '../utils/aiSettings.js';

// --- 响应式版本号，自定义数据变更时递增，用于强制 computed 重算 ---
const settingsVersion = ref(0);
const refreshSettings = () => { settingsVersion.value++; };

// --- 厂商列表 ---
const builtInProviders = AI_PROVIDERS;
const customProviderList = computed(() => {
  settingsVersion.value; // dependency
  return getCustomProviders();
});
const allProviders = computed(() => {
  settingsVersion.value;
  return getAllProviders();
});

// --- 表单数据 ---
const form = ref(loadAiSettings());
const saving = ref(false);
const testing = ref(false);

// --- 当前厂商信息 ---
const currentProvider = computed(() =>
  allProviders.value.find((p) => p.id === form.value.providerId) || allProviders.value[0],
);
const isCustomProvider = computed(() =>
  customProviderList.value.some((p) => p.id === form.value.providerId),
);

// --- 模型列表 ---
const builtInModels = computed(() => currentProvider.value?.models || []);
const customModelsForProvider = computed(() => {
  settingsVersion.value; // dependency
  return getCustomModels(form.value.providerId);
});

const maskedKey = computed(() => maskApiKey(form.value.apiKey));

// --- 对话框状态 ---
const showAddProvider = ref(false);
const addProviderForm = ref({ name: '', baseUrl: '' });
const savingProvider = ref(false);
const showAddModel = ref(false);
const newModelName = ref('');

// --- 厂商切换 ---
const handleProviderChange = (providerId) => {
  setCurrentProviderId(providerId);
  form.value = loadProviderSettings(providerId);
};

// --- 保存配置 ---
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

// --- 测试连接 ---
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

// --- 新增自定义厂商 ---
const resetAddProviderForm = () => { addProviderForm.value = { name: '', baseUrl: '' }; };

const handleAddProvider = () => {
  const { name, baseUrl } = addProviderForm.value;
  if (!name.trim() || !baseUrl.trim()) {
    return ElMessage.warning('请填写厂商名称和 Base URL');
  }
  savingProvider.value = true;
  try {
    const newProvider = saveCustomProvider(name.trim(), baseUrl.trim());
    refreshSettings();
    handleProviderChange(newProvider.id);
    showAddProvider.value = false;
    ElMessage.success(`自定义厂商「${newProvider.name}」已添加`);
  } finally {
    savingProvider.value = false;
  }
};

// --- 删除自定义厂商 ---
const handleDeleteProvider = async () => {
  const providerName = currentProvider.value?.name;
  try {
    await ElMessageBox.confirm(
      `确认删除厂商「${providerName}」？该厂商的所有已保存配置和自定义模型将被一并清除，此操作不可撤销。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return; // 用户取消
  }
  deleteCustomProvider(form.value.providerId);
  refreshSettings();
  form.value = loadAiSettings();
  ElMessage.success(`厂商「${providerName}」已删除`);
};

// --- 新增自定义模型 ---
const handleAddModel = () => {
  const modelName = newModelName.value.trim();
  if (!modelName) return ElMessage.warning('请输入模型名称');
  addCustomModel(form.value.providerId, modelName);
  refreshSettings();
  form.value.model = modelName;
  showAddModel.value = false;
  ElMessage.success(`模型「${modelName}」已添加`);
};

// --- 删除自定义模型 ---
const handleDeleteModel = (modelName) => {
  deleteCustomModel(form.value.providerId, modelName);
  refreshSettings();
  if (form.value.model === modelName) {
    const remaining = getAllModels(form.value.providerId);
    form.value.model = remaining[0] || '';
  }
  ElMessage.success(`模型「${modelName}」已删除`);
};
</script>

<style scoped>
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.custom-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.temperature-row {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 520px;
}

.temperature-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
</style>