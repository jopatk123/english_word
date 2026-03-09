<template>
  <div class="detail-view">
    <!-- 面包屑导航 -->
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>词根：{{ root?.name }}</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 词根信息卡片 -->
    <el-card class="info-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span class="root-name">{{ root?.name }}</span>
          <span class="root-meaning">— {{ root?.meaning }}</span>
        </div>
      </template>
      <p v-if="root?.remark" class="remark-text">备注：{{ root.remark }}</p>
      <p v-else class="remark-text muted">暂无备注</p>
    </el-card>

    <!-- 单词列表 -->
    <div class="section-header">
      <h3>关联单词（{{ words.length }}）</h3>
      <el-button type="primary" @click="openWordDialog()">添加单词</el-button>
    </div>

    <el-table :data="words" stripe empty-text="暂无单词" v-loading="wordsLoading">
      <el-table-column prop="name" label="单词" min-width="120">
        <template #default="{ row }">
          <el-link type="primary" @click="$router.push(`/word/${row.id}`)">
            <strong>{{ row.name }}</strong>
          </el-link>
        </template>
      </el-table-column>
      <el-table-column prop="meaning" label="含义" min-width="150" />
      <el-table-column prop="phonetic" label="音标" min-width="120" />
      <el-table-column prop="exampleCount" label="例句数" width="90" align="center" />
      <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openWordDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteWord(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 单词表单对话框 -->
    <el-dialog v-model="wordDialogVisible" :title="editingWord ? '编辑单词' : '添加单词'" width="500px" destroy-on-close>
      <el-form :model="wordForm" label-width="80px">
        <el-form-item label="单词" required>
          <el-input v-model="wordForm.name" placeholder="如：reject" />
        </el-form-item>
        <el-form-item label="含义" required>
          <el-input v-model="wordForm.meaning" placeholder="如：拒绝；排斥" />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="wordForm.phonetic" placeholder="如：/rɪˈdʒekt/" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="wordForm.remark" type="textarea" :rows="2" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveWord" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getRoot, getWords, createWord, updateWord, deleteWord } from '../api/index.js';

const props = defineProps({ id: String });
const route = useRoute();

const root = ref(null);
const words = ref([]);
const loading = ref(false);
const wordsLoading = ref(false);

const wordDialogVisible = ref(false);
const editingWord = ref(null);
const wordForm = ref({ name: '', meaning: '', phonetic: '', remark: '' });
const saving = ref(false);

const rootId = props.id || route.params.id;

const fetchRoot = async () => {
  loading.value = true;
  try {
    const res = await getRoot(rootId);
    root.value = res.data;
  } catch {
    ElMessage.error('获取词根信息失败');
  } finally {
    loading.value = false;
  }
};

const fetchWords = async () => {
  wordsLoading.value = true;
  try {
    const res = await getWords({ rootId });
    words.value = res.data;
  } catch {
    ElMessage.error('获取单词列表失败');
  } finally {
    wordsLoading.value = false;
  }
};

const openWordDialog = (word = null) => {
  editingWord.value = word;
  wordForm.value = word
    ? { name: word.name, meaning: word.meaning, phonetic: word.phonetic || '', remark: word.remark || '' }
    : { name: '', meaning: '', phonetic: '', remark: '' };
  wordDialogVisible.value = true;
};

const handleSaveWord = async () => {
  if (!wordForm.value.name || !wordForm.value.meaning) {
    return ElMessage.warning('请填写单词和含义');
  }
  saving.value = true;
  try {
    if (editingWord.value) {
      await updateWord(editingWord.value.id, wordForm.value);
      ElMessage.success('更新成功');
    } else {
      await createWord({ ...wordForm.value, rootId });
      ElMessage.success('添加成功');
    }
    wordDialogVisible.value = false;
    fetchWords();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const handleDeleteWord = async (word) => {
  try {
    await ElMessageBox.confirm(
      `确定删除单词「${word.name}」？关联的例句将一并删除。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
    await deleteWord(word.id);
    ElMessage.success('删除成功');
    fetchWords();
  } catch {
    // 取消
  }
};

onMounted(() => {
  fetchRoot();
  fetchWords();
});
</script>
