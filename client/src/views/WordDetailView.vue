<template>
  <div class="detail-view">
    <!-- 面包屑导航 -->
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item
        v-if="word?.roots?.length === 1"
        :to="{ path: `/root/${word.roots[0].id}` }"
      >
        词根：{{ word.roots[0].name }}
      </el-breadcrumb-item>
      <el-breadcrumb-item v-else>单词详情</el-breadcrumb-item>
      <el-breadcrumb-item>单词：{{ word?.name }}</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 单词信息卡片 -->
    <el-card class="info-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span class="root-name">{{ word?.name }}</span>
          <span v-if="word?.phonetic" class="phonetic">{{ word.phonetic }}</span>
          <SpeakButton v-if="word?.name" :text="word.name" />
          <span class="root-meaning">— {{ word?.meaning }}</span>
        </div>
      </template>
      <p class="remark-text">
        所属词根：
        <template v-for="(root, idx) in word?.roots || []" :key="root.id">
          <el-link type="primary" @click="$router.push(`/root/${root.id}`)">
            {{ root.name }}（{{ root.meaning }}）
          </el-link>
          <span v-if="idx < word.roots.length - 1">、</span>
        </template>
        <span v-if="!word?.roots?.length">无</span>
      </p>
      <p v-if="word?.remark" class="remark-text">备注：{{ word.remark }}</p>
    </el-card>

    <!-- 例句列表 -->
    <div class="section-header">
      <h3>例句（{{ examples.length }}）</h3>
      <div class="section-actions">
        <el-button
          v-if="word?.roots?.length === 1"
          type="info"
          @click="$router.push(`/root/${word.roots[0].id}`)"
          >返回词根</el-button
        >
        <el-button v-else type="info" @click="$router.push('/')">返回首页</el-button>
        <el-button type="success" @click="$router.push(`/word/${wordId}/ai-examples`)"
          >智能添加例句</el-button
        >
        <el-button type="warning" @click="openRootDialog()">添加词根</el-button>
        <el-button type="danger" @click="openDeleteRootDialog()">删除词根</el-button>
        <el-button type="primary" @click="openExampleDialog()">添加例句</el-button>
      </div>
    </div>

    <div v-if="examples.length === 0 && !examplesLoading" class="empty-tip">
      暂无例句，点击"添加例句"开始吧
    </div>

    <div v-loading="examplesLoading" class="example-list">
      <el-card v-for="example in examples" :key="example.id" class="example-card" shadow="hover">
        <div class="example-content">
          <p class="example-sentence">{{ example.sentence }}</p>
          <p class="example-translation">{{ example.translation }}</p>
          <p v-if="example.remark" class="example-remark">
            <el-tag size="small" type="info">{{ example.remark }}</el-tag>
          </p>
        </div>
        <div class="example-actions">
          <SpeakButton :text="example.sentence" />
          <el-button
            link
            type="success"
            :loading="regeneratingExampleId === example.id"
            @click="handleRegenerateExample(example)"
            >重新生成</el-button
          >
          <el-button link type="primary" @click="openExampleDialog(example)">编辑</el-button>
          <el-button link type="danger" @click="handleDeleteExample(example)">删除</el-button>
        </div>
      </el-card>
    </div>

    <!-- 例句表单对话框 -->
    <el-dialog
      v-model="exampleDialogVisible"
      :title="editingExample ? '编辑例句' : '添加例句'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="exampleForm" label-width="80px">
        <el-form-item label="例句原文" required>
          <el-input
            v-model="exampleForm.sentence"
            type="textarea"
            :rows="3"
            placeholder="英文例句"
          />
        </el-form-item>
        <el-form-item label="翻译" required>
          <el-input
            v-model="exampleForm.translation"
            type="textarea"
            :rows="2"
            placeholder="中文翻译"
          />
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

    <!-- 添加词根对话框 -->
    <el-dialog v-model="rootDialogVisible" title="添加到词根" width="420px" destroy-on-close>
      <p style="margin: 0 0 12px; color: #606266">
        将 <strong>{{ word?.name }}</strong> 添加到已有词根中：
      </p>
      <el-select
        v-model="selectedRootId"
        placeholder="请选择词根"
        filterable
        clearable
        style="width: 100%"
        :loading="allRootsLoading"
        no-data-text="暂无可选词根"
      >
        <el-option
          v-for="rootItem in availableRoots"
          :key="rootItem.id"
          :label="rootItem.name + (rootItem.meaning ? ' — ' + rootItem.meaning : '')"
          :value="rootItem.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="rootDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addingRoot" @click="handleAddRoot">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 删除词根对话框 -->
    <el-dialog v-model="deleteRootDialogVisible" title="删除词根" width="420px" destroy-on-close>
      <p style="margin: 0 0 12px; color: #606266">
        从 <strong>{{ word?.name }}</strong> 中移除一个已关联的词根：
      </p>
      <el-select
        v-model="selectedDeleteRootId"
        placeholder="请选择要删除的词根"
        filterable
        clearable
        style="width: 100%"
        no-data-text="暂无可删除的词根"
      >
        <el-option
          v-for="rootItem in associatedRoots"
          :key="rootItem.id"
          :label="rootItem.name + (rootItem.meaning ? ' — ' + rootItem.meaning : '')"
          :value="rootItem.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="deleteRootDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deletingRoot" @click="handleDeleteRoot"
          >确认删除</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { useRoute } from 'vue-router';
  import SpeakButton from '../components/SpeakButton.vue';
  import { useWordDetail } from '../composables/useWordDetail.js';

  const props = defineProps({ id: String });
  const route = useRoute();

  const wordId = props.id || route.params.id;

  const {
    word,
    examples,
    loading,
    examplesLoading,
    rootDialogVisible,
    selectedRootId,
    addingRoot,
    allRootsLoading,
    deleteRootDialogVisible,
    selectedDeleteRootId,
    deletingRoot,
    availableRoots,
    associatedRoots,
    exampleDialogVisible,
    editingExample,
    exampleForm,
    saving,
    regeneratingExampleId,
    openExampleDialog,
    openRootDialog,
    openDeleteRootDialog,
    handleAddRoot,
    handleDeleteRoot,
    handleSaveExample,
    handleDeleteExample,
    handleRegenerateExample,
    setWordForTest,
    setSelectedRootIdForTest,
    setSelectedDeleteRootIdForTest,
  } = useWordDetail(wordId);

  defineExpose({
    setWordForTest,
    setSelectedRootIdForTest,
    setSelectedDeleteRootIdForTest,
    handleAddRoot,
    handleDeleteRoot,
    openRootDialog,
    openDeleteRootDialog,
  });
</script>
