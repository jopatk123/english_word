<template>
  <div class="detail-view">
    <!-- 面包屑导航 -->
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: `/root/${word?.root?.id}` }">
        词根：{{ word?.root?.name }}
      </el-breadcrumb-item>
      <el-breadcrumb-item>单词：{{ word?.name }}</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 单词信息卡片 -->
    <el-card class="info-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span class="root-name">{{ word?.name }}</span>
          <span v-if="word?.phonetic" class="phonetic">{{ word.phonetic }}</span>
          <span class="root-meaning">— {{ word?.meaning }}</span>
        </div>
      </template>
      <p class="remark-text">
        所属词根：
        <el-link type="primary" @click="$router.push(`/root/${word?.root?.id}`)">
          {{ word?.root?.name }}（{{ word?.root?.meaning }}）
        </el-link>
      </p>
      <p v-if="word?.remark" class="remark-text">备注：{{ word.remark }}</p>
    </el-card>

    <!-- 例句列表 -->
    <div class="section-header">
      <h3>例句（{{ examples.length }}）</h3>
      <el-button type="primary" @click="openExampleDialog()">添加例句</el-button>
    </div>

    <div v-if="examples.length === 0 && !examplesLoading" class="empty-tip">
      暂无例句，点击"添加例句"开始吧
    </div>

    <div v-loading="examplesLoading" class="example-list">
      <el-card
        v-for="example in examples"
        :key="example.id"
        class="example-card"
        shadow="hover"
      >
        <div class="example-content">
          <p class="example-sentence">{{ example.sentence }}</p>
          <p class="example-translation">{{ example.translation }}</p>
          <p v-if="example.remark" class="example-remark">
            <el-tag size="small" type="info">{{ example.remark }}</el-tag>
          </p>
        </div>
        <div class="example-actions">
          <el-button link type="primary" @click="openExampleDialog(example)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteExample(example)">删除</el-button>
        </div>
      </el-card>
    </div>

    <!-- 例句表单对话框 -->
    <el-dialog v-model="exampleDialogVisible" :title="editingExample ? '编辑例句' : '添加例句'" width="600px" destroy-on-close>
      <el-form :model="exampleForm" label-width="80px">
        <el-form-item label="例句原文" required>
          <el-input v-model="exampleForm.sentence" type="textarea" :rows="3" placeholder="英文例句" />
        </el-form-item>
        <el-form-item label="翻译" required>
          <el-input v-model="exampleForm.translation" type="textarea" :rows="2" placeholder="中文翻译" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="exampleForm.remark" placeholder="如：高频考点、来源等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exampleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveExample" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getWord, getExamples, createExample, updateExample, deleteExample } from '../api/index.js';

const props = defineProps({ id: String });
const route = useRoute();

const word = ref(null);
const examples = ref([]);
const loading = ref(false);
const examplesLoading = ref(false);

const exampleDialogVisible = ref(false);
const editingExample = ref(null);
const exampleForm = ref({ sentence: '', translation: '', remark: '' });
const saving = ref(false);

const wordId = props.id || route.params.id;

const fetchWord = async () => {
  loading.value = true;
  try {
    const res = await getWord(wordId);
    word.value = res.data;
  } catch {
    ElMessage.error('获取单词信息失败');
  } finally {
    loading.value = false;
  }
};

const fetchExamples = async () => {
  examplesLoading.value = true;
  try {
    const res = await getExamples({ wordId });
    examples.value = res.data;
  } catch {
    ElMessage.error('获取例句列表失败');
  } finally {
    examplesLoading.value = false;
  }
};

const openExampleDialog = (example = null) => {
  editingExample.value = example;
  exampleForm.value = example
    ? { sentence: example.sentence, translation: example.translation, remark: example.remark || '' }
    : { sentence: '', translation: '', remark: '' };
  exampleDialogVisible.value = true;
};

const handleSaveExample = async () => {
  if (!exampleForm.value.sentence || !exampleForm.value.translation) {
    return ElMessage.warning('请填写例句原文和翻译');
  }
  saving.value = true;
  try {
    if (editingExample.value) {
      await updateExample(editingExample.value.id, exampleForm.value);
      ElMessage.success('更新成功');
    } else {
      await createExample({ ...exampleForm.value, wordId });
      ElMessage.success('添加成功');
    }
    exampleDialogVisible.value = false;
    fetchExamples();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const handleDeleteExample = async (example) => {
  try {
    await ElMessageBox.confirm(
      '确定删除这条例句？',
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
    await deleteExample(example.id);
    ElMessage.success('删除成功');
    fetchExamples();
  } catch {
    // 取消
  }
};

onMounted(() => {
  fetchWord();
  fetchExamples();
});
</script>
