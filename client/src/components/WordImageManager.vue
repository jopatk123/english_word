<template>
  <section class="word-image-manager">
    <div class="word-image-manager-header">
      <h4>记忆图片</h4>
      <p class="word-image-hint">{{ hintText }}</p>
    </div>

    <WordImage
      v-if="hasImage"
      :key="imageNonce"
      :word-id="wordId"
      :has-image="hasImage"
      :alt="`${wordName} 的记忆图片`"
      variant="card"
    />

    <div v-else class="word-image-empty">还没有记忆图片，上传一张能帮你想起这个单词的图吧。</div>

    <div class="word-image-actions">
      <input
        ref="fileInputRef"
        class="word-image-file"
        type="file"
        :accept="WORD_IMAGE.ACCEPT"
        @change="handleFileChange"
      />
      <el-button type="primary" :loading="uploading" @click="openFilePicker">
        {{ hasImage ? '替换图片' : '上传图片' }}
      </el-button>
      <el-button :disabled="!hasImage || uploading" :loading="downloading" @click="handleDownload">
        下载图片
      </el-button>
      <el-button
        type="danger"
        :disabled="!hasImage || uploading"
        :loading="removing"
        @click="handleRemove"
      >
        删除图片
      </el-button>
    </div>
  </section>
</template>

<script setup>
  import { computed, ref } from 'vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import WordImage from './WordImage.vue';
  import {
    WORD_IMAGE,
    WORD_IMAGE_HINT,
    buildWordImageDownloadName,
  } from '../constants/wordImage.js';
  import { compressWordImageFile } from '../utils/wordImageCompress.js';
  import { readApiErrorMessage } from '../composables/useWordImage.js';
  import { uploadWordImage, deleteWordImage, getWordImageBlob } from '../api/index.js';

  const props = defineProps({
    wordId: { type: [Number, String], required: true },
    wordName: { type: String, default: '' },
    hasImage: { type: Boolean, default: false },
  });

  const emit = defineEmits(['update:hasImage']);

  const hintText = computed(
    () =>
      `推荐分辨率：${WORD_IMAGE_HINT.recommended}，也可使用 ${WORD_IMAGE_HINT.square}。最短边不少于 ${WORD_IMAGE_HINT.minShortSide} 像素，最长边不超过 ${WORD_IMAGE_HINT.maxLongSide} 像素，宽高比 1:2 到 2:1。程序会自动压缩到 ${WORD_IMAGE_HINT.maxBytesKB}KB 以内，并优先保留清晰度。支持 JPEG / PNG / WebP，原始文件不超过 ${WORD_IMAGE_HINT.maxOriginalMB}MB。`
  );

  const fileInputRef = ref(null);
  const uploading = ref(false);
  const downloading = ref(false);
  const removing = ref(false);
  const imageNonce = ref(0);

  const openFilePicker = () => {
    fileInputRef.value?.click();
  };

  const resetFileInput = () => {
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    resetFileInput();
    if (!file) return;

    uploading.value = true;
    try {
      const compressed = await compressWordImageFile(file);
      const res = await uploadWordImage(props.wordId, compressed);
      imageNonce.value += 1;
      emit('update:hasImage', true);
      ElMessage.success(res?.msg || (props.hasImage ? '记忆图片已替换' : '记忆图片已保存'));
    } catch (err) {
      ElMessage.error(await readApiErrorMessage(err, err?.message || '上传失败'));
    } finally {
      uploading.value = false;
    }
  };

  const handleDownload = async () => {
    if (!props.hasImage || downloading.value) return;
    downloading.value = true;
    try {
      const blob = await getWordImageBlob(props.wordId, { download: true });
      if (blob?.type && blob.type.includes('application/json')) {
        throw new Error('下载记忆图片失败');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildWordImageDownloadName(props.wordName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      ElMessage.error(await readApiErrorMessage(err, '下载记忆图片失败'));
    } finally {
      downloading.value = false;
    }
  };

  const handleRemove = async () => {
    try {
      await ElMessageBox.confirm('确定删除这张记忆图片？单词本身不会被删除。', '确认删除', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }

    removing.value = true;
    try {
      await deleteWordImage(props.wordId);
      emit('update:hasImage', false);
      ElMessage.success('记忆图片已删除');
    } catch (err) {
      ElMessage.error(await readApiErrorMessage(err, '删除记忆图片失败'));
    } finally {
      removing.value = false;
    }
  };
</script>
