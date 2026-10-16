<template>
  <div class="passage-page">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/reading' }">短文阅读</el-breadcrumb-item>
      <el-breadcrumb-item v-if="isEdit" :to="{ path: `/reading/${id}` }">
        {{ form.title || '短文' }}
      </el-breadcrumb-item>
      <el-breadcrumb-item>{{ isEdit ? '编辑' : '新建短文' }}</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="passage-edit-card" v-loading="loading">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="手动粘贴" name="manual">
          <el-form label-position="top" class="passage-form" @submit.prevent>
            <el-form-item label="标题" required>
              <el-input
                v-model="form.title"
                :maxlength="PASSAGE_MAX_TITLE_LENGTH"
                placeholder="例如：A Rainy Morning"
              />
            </el-form-item>
            <el-form-item label="难度">
              <el-select v-model="form.level" placeholder="可选" clearable>
                <el-option
                  v-for="level in PASSAGE_LEVELS"
                  :key="level"
                  :label="level"
                  :value="level"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="英文正文" required>
              <el-input
                v-model="form.content"
                type="textarea"
                :autosize="{ minRows: 8, maxRows: 20 }"
                :maxlength="PASSAGE_MAX_CONTENT_LENGTH"
                show-word-limit
                placeholder="粘贴英文短文，段落之间空一行"
              />
              <p class="passage-form-hint">
                保存时自动分段分句。修改正文后，没有改动的句子会保留原来的译文。
              </p>
            </el-form-item>
            <el-form-item label="中文译文（可选）">
              <el-input
                v-model="form.translation"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 14 }"
                :maxlength="PASSAGE_MAX_TRANSLATION_LENGTH"
                :placeholder="
                  isEdit ? '填写后会覆盖现有的逐句译文；留空则保持不变' : '整篇粘贴即可，会按句对齐'
                "
              />
              <p class="passage-form-hint">
                译文句数与原文一致时逐句对应，否则整段放在第一句。也可以保存后用 AI 补全译文。
              </p>
            </el-form-item>
            <div class="passage-form-actions">
              <el-button @click="goBack">取消</el-button>
              <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="!isEdit" label="AI 生成" name="ai">
          <PassageAiGenerateForm @saved="onSaved" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import PassageAiGenerateForm from '../components/passage/PassageAiGenerateForm.vue';
  import { createPassage, getPassage, updatePassage } from '../api/index.js';
  import {
    PASSAGE_LEVELS,
    PASSAGE_MAX_CONTENT_LENGTH,
    PASSAGE_MAX_TITLE_LENGTH,
    PASSAGE_MAX_TRANSLATION_LENGTH,
  } from '../constants/passage.js';

  const props = defineProps({
    id: { type: [String, Number], default: null },
  });

  const router = useRouter();
  const isEdit = computed(() => props.id !== null && props.id !== undefined);
  const activeTab = ref('manual');
  const loading = ref(false);
  const saving = ref(false);
  const form = reactive({ title: '', level: '', content: '', translation: '' });

  const loadPassage = async () => {
    loading.value = true;
    try {
      const res = await getPassage(props.id);
      form.title = res.data.title;
      form.level = res.data.level || '';
      form.content = res.data.content;
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '获取短文失败');
      router.replace('/reading');
    } finally {
      loading.value = false;
    }
  };

  const onSaved = (passageId, msg) => {
    if (msg && msg !== '保存成功') ElMessage.warning(msg);
    else ElMessage.success('保存成功');
    router.replace(`/reading/${passageId}`);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return ElMessage.warning('请填写标题');
    if (!form.content.trim()) return ElMessage.warning('请填写英文正文');

    saving.value = true;
    try {
      const payload = {
        title: form.title,
        level: form.level || null,
        content: form.content,
        ...(form.translation.trim() ? { translation: form.translation } : {}),
      };
      const res = isEdit.value
        ? await updatePassage(props.id, payload)
        : await createPassage(payload);
      onSaved(res.data.id, res.msg);
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '保存失败');
    } finally {
      saving.value = false;
    }
  };

  const goBack = () => {
    router.push(isEdit.value ? `/reading/${props.id}` : '/reading');
  };

  onMounted(() => {
    if (isEdit.value) loadPassage();
  });
</script>
