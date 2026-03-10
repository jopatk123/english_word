<template>
  <div class="home-view">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索词根或单词..."
        clearable
        size="large"
        @input="onSearch"
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 搜索结果：单词 -->
    <div v-if="searchKeyword && wordResults.length" class="search-results">
      <h3>单词搜索结果</h3>
      <el-table :data="wordResults" stripe>
        <el-table-column prop="name" label="单词" min-width="120">
          <template #default="{ row }">
            <div class="cell-with-speak">
              <span>{{ row.name }}</span>
              <SpeakButton :text="row.name" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="含义" min-width="150" />
        <el-table-column label="所属词根" min-width="120">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/root/${row.root?.id}`)">
              {{ row.root?.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/word/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 词根列表 -->
    <div class="root-section">
      <div class="section-header">
        <h2>词根列表</h2>
        <div class="section-actions">
          <el-button @click="$router.push('/ai/settings')">AI 配置</el-button>
          <el-button type="success" @click="$router.push('/ai/roots')">智能添加词根</el-button>
          <el-button type="primary" @click="openRootDialog()">添加词根</el-button>
        </div>
      </div>

      <el-table :data="roots" stripe v-loading="loading" empty-text="暂无词根，点击「添加词根」开始吧">
        <el-table-column prop="name" label="词根" min-width="120">
          <template #default="{ row }">
            <div class="cell-with-speak">
              <el-link type="primary" @click="$router.push(`/root/${row.id}`)">
                <strong>{{ row.name }}</strong>
              </el-link>
              <SpeakButton :text="row.name" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="核心含义" min-width="150" />
        <el-table-column prop="wordCount" label="单词数" width="90" align="center" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openRootDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDeleteRoot(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 词根表单对话框 -->
    <el-dialog v-model="rootDialogVisible" :title="editingRoot ? '编辑词根' : '添加词根'" width="500px" destroy-on-close>
      <el-form :model="rootForm" label-width="80px">
        <el-form-item label="词根" required>
          <el-input v-model="rootForm.name" placeholder="如：ject" />
        </el-form-item>
        <el-form-item label="核心含义" required>
          <el-input v-model="rootForm.meaning" placeholder="如：投，扔" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="rootForm.remark" type="textarea" :rows="2" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rootDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRoot" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getRoots, createRoot, updateRoot, deleteRoot, getWords } from '../api/index.js';
import SpeakButton from '../components/SpeakButton.vue';

const roots = ref([]);
const loading = ref(false);
const searchKeyword = ref('');
const wordResults = ref([]);

const rootDialogVisible = ref(false);
const editingRoot = ref(null);
const rootForm = ref({ name: '', meaning: '', remark: '' });
const saving = ref(false);

let searchTimer = null;

const fetchRoots = async (keyword) => {
  loading.value = true;
  try {
    const res = await getRoots(keyword);
    roots.value = res.data;
  } catch (e) {
    ElMessage.error('获取词根列表失败');
  } finally {
    loading.value = false;
  }
};

const searchWords = async (keyword) => {
  if (!keyword) {
    wordResults.value = [];
    return;
  }
  try {
    const res = await getWords({ keyword });
    wordResults.value = res.data;
  } catch {
    wordResults.value = [];
  }
};

const onSearch = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    fetchRoots(searchKeyword.value);
    searchWords(searchKeyword.value);
  }, 300);
};

const openRootDialog = (root = null) => {
  editingRoot.value = root;
  rootForm.value = root
    ? { name: root.name, meaning: root.meaning, remark: root.remark || '' }
    : { name: '', meaning: '', remark: '' };
  rootDialogVisible.value = true;
};

const handleSaveRoot = async () => {
  if (!rootForm.value.name || !rootForm.value.meaning) {
    return ElMessage.warning('请填写词根和核心含义');
  }
  saving.value = true;
  try {
    if (editingRoot.value) {
      await updateRoot(editingRoot.value.id, rootForm.value);
      ElMessage.success('更新成功');
    } else {
      await createRoot(rootForm.value);
      ElMessage.success('添加成功');
    }
    rootDialogVisible.value = false;
    fetchRoots(searchKeyword.value);
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const handleDeleteRoot = async (root) => {
  try {
    await ElMessageBox.confirm(
      `确定删除词根「${root.name}」？关联的单词和例句将一并删除。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
    await deleteRoot(root.id);
    ElMessage.success('删除成功');
    fetchRoots(searchKeyword.value);
  } catch {
    // 取消删除
  }
};

onMounted(() => fetchRoots());
</script>
