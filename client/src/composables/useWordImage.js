import { ref, watch, onUnmounted } from 'vue';
import { getWordImageBlob } from '../api/index.js';

export async function readApiErrorMessage(err, fallback = '操作失败') {
  const data = err?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.msg || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.msg || err?.message || fallback;
}

export function useWordImage(wordIdRef, hasImageRef) {
  const objectUrl = ref('');
  const loading = ref(false);
  const loadError = ref('');

  const revoke = () => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = '';
    }
  };

  const load = async () => {
    const wordId = typeof wordIdRef === 'function' ? wordIdRef() : wordIdRef.value;
    const hasImage = typeof hasImageRef === 'function' ? hasImageRef() : hasImageRef.value;
    revoke();
    loadError.value = '';
    if (!wordId || !hasImage) {
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const blob = await getWordImageBlob(wordId);
      if (blob?.type && blob.type.includes('application/json')) {
        throw new Error('加载记忆图片失败');
      }
      objectUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      loadError.value = await readApiErrorMessage(err, '加载记忆图片失败');
    } finally {
      loading.value = false;
    }
  };

  watch(
    [wordIdRef, hasImageRef],
    () => {
      void load();
    },
    { immediate: true }
  );

  onUnmounted(revoke);

  return { objectUrl, loading, loadError, reload: load };
}
