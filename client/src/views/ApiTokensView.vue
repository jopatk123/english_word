<template>
  <div class="ai-page">
    <el-breadcrumb separator="/" class="page-breadcrumb">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>API Token</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="ai-card">
      <template #header>
        <div class="page-heading page-heading-between">
          <div>
            <h2>API Token 管理</h2>
            <p>
              创建 API Token 供脚本或 Agent 访问普通业务 API。Token
              权限与当前账号一致，但不能访问超级管理员接口，也不能用 Token 再创建或撤销 Token。
            </p>
          </div>
          <el-button type="primary" @click="showCreateDialog = true">创建新 Token</el-button>
        </div>
      </template>

      <div v-if="loading" class="tokens-loading">加载中...</div>
      <el-empty v-else-if="tokens.length === 0" description="暂无 API Token">
        <el-button type="primary" @click="showCreateDialog = true">创建第一个 Token</el-button>
      </el-empty>
      <div v-else class="table-scroll">
        <el-table :data="tokens" style="width: 100%">
          <el-table-column label="名称" prop="name" min-width="140">
            <template #default="{ row }">
              <span v-if="row.name">{{ row.name }}</span>
              <span v-else class="token-muted">未命名</span>
            </template>
          </el-table-column>
          <el-table-column label="前缀" prop="tokenPrefix" min-width="150">
            <template #default="{ row }">
              <code class="token-prefix">{{ row.tokenPrefix || '-' }}</code>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="最后使用" min-width="160">
            <template #default="{ row }">
              <span v-if="row.lastUsedAt">{{ formatDate(row.lastUsedAt) }}</span>
              <span v-else class="token-muted">从未使用</span>
            </template>
          </el-table-column>
          <el-table-column label="过期时间" min-width="180">
            <template #default="{ row }">
              <span v-if="row.expiresAt" :class="{ 'token-expired': isExpired(row.expiresAt) }">
                {{ formatDate(row.expiresAt) }}
                <el-tag v-if="isExpired(row.expiresAt)" type="danger" size="small">已过期</el-tag>
              </span>
              <span v-else class="token-muted">永不过期</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-popconfirm
                title="确定要撤销此 Token 吗？"
                confirm-button-text="撤销"
                cancel-button-text="取消"
                @confirm="handleRevoke(row.id)"
              >
                <template #reference>
                  <el-button link type="danger" size="small">撤销</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-dialog
      v-model="showCreateDialog"
      title="创建 API Token"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="createForm" label-width="88px">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="可选，例如：本地脚本" maxlength="100" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="createForm.expiresAt"
            type="datetime"
            placeholder="可选，留空则永不过期"
            :disabled-date="disabledDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-alert title="注意" type="warning" :closable="false" class="create-token-alert">
          Token
          只会在创建时显示一次，请妥善保存。建议设置过期时间；留空则永不过期，泄露后需手动撤销。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showTokenDialog"
      title="Token 创建成功"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="请妥善保存此 Token，关闭后将不会再次显示"
        type="success"
        :closable="false"
        class="create-token-alert"
      />
      <div class="token-display">
        <div class="token-text">{{ createdToken }}</div>
        <el-button @click="copyToken">复制</el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="showTokenDialog = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { onMounted, ref } from 'vue';
  import { ElMessage } from 'element-plus';
  import { createApiToken, listApiTokens, revokeApiToken } from '../api/index.js';

  const tokens = ref([]);
  const loading = ref(false);
  const creating = ref(false);
  const showCreateDialog = ref(false);
  const showTokenDialog = ref(false);
  const createdToken = ref('');
  const createForm = ref({ name: '', expiresAt: null });

  const loadTokens = async () => {
    loading.value = true;
    try {
      const response = await listApiTokens();
      tokens.value = Array.isArray(response.data) ? response.data : [];
    } catch {
      tokens.value = [];
    } finally {
      loading.value = false;
    }
  };

  const handleCreate = async () => {
    creating.value = true;
    try {
      const payload = {
        name: createForm.value.name || undefined,
        expiresAt: createForm.value.expiresAt
          ? new Date(createForm.value.expiresAt).toISOString()
          : undefined,
      };
      const response = await createApiToken(payload);
      const token = response.data?.token;
      if (!token) {
        ElMessage.error('创建成功但未返回 Token，请到列表核对后重新创建');
        await loadTokens();
        return;
      }
      createdToken.value = token;
      showCreateDialog.value = false;
      showTokenDialog.value = true;
      createForm.value = { name: '', expiresAt: null };
      await loadTokens();
      ElMessage.success('Token 创建成功');
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '创建 Token 失败');
    } finally {
      creating.value = false;
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeApiToken(id);
      ElMessage.success('Token 已撤销');
      await loadTokens();
    } catch (e) {
      ElMessage.error(e?.response?.data?.msg || '撤销 Token 失败');
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(createdToken.value);
      ElMessage.success('Token 已复制到剪贴板');
    } catch {
      ElMessage.error('复制失败，请手动复制');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (dateString) => Boolean(dateString) && new Date(dateString) < new Date();
  const disabledDate = (date) => date < new Date(new Date().setHours(0, 0, 0, 0));

  onMounted(() => {
    loadTokens();
  });
</script>

<style scoped>
  .tokens-loading {
    text-align: center;
    padding: 40px;
    color: #909399;
  }

  .token-muted {
    color: #909399;
  }

  .token-prefix {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }

  .token-expired {
    color: #f56c6c;
  }

  .create-token-alert {
    margin-bottom: 8px;
  }

  .token-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;
  }

  .token-text {
    flex: 1;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    word-break: break-all;
    line-height: 1.6;
  }
</style>
