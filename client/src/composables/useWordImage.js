import { ref, watch, onUnmounted } from 'vue';
import { getCachedWordImageBlob } from '../utils/wordImageCache.js';

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
  // 递增序号用于丢弃过期的加载结果：快速切换卡片时旧请求可能后返回，
  // 避免旧单词的图片覆盖当前卡片，也避免覆盖或卸载后产生无法回收的 objectURL。
  let loadSeq = 0;

  const revoke = () => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = '';
    }
  };

  const load = async () => {
    const seq = ++loadSeq;
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
      const blob = await getCachedWordImageBlob(wordId);
      if (seq !== loadSeq) return;
      objectUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      const message = await readApiErrorMessage(err, '加载记忆图片失败');
      if (seq !== loadSeq) return;
      loadError.value = message;
    } finally {
      if (seq === loadSeq) {
        loading.value = false;
      }
    }
  };

  watch(
    [wordIdRef, hasImageRef],
    () => {
      void load();
    },
    { immediate: true }
  );

  onUnmounted(() => {
    loadSeq += 1; // 使在途请求过期，卸载后不再创建无人回收的 objectURL
    revoke();
  });

  return { objectUrl, loading, loadError, reload: load };
}
