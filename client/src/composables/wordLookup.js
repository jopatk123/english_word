import { reactive } from 'vue';
import { createWord, lookupWord } from '../api/index.js';
import { loadAiSettings } from '../utils/aiSettings.js';
import { normalizeLookupWord } from '../utils/sentenceTokens.js';

const cache = new Map();
let requestSeq = 0;

export const wordLookupState = reactive({
  visible: false,
  anchor: null,
  word: '',
  sentence: '',
  loading: false,
  adding: false,
  error: '',
  result: null,
});

export function clearWordLookupSession() {
  cache.clear();
  requestSeq += 1;
  wordLookupState.visible = false;
  wordLookupState.anchor = null;
  wordLookupState.word = '';
  wordLookupState.sentence = '';
  wordLookupState.loading = false;
  wordLookupState.adding = false;
  wordLookupState.error = '';
  wordLookupState.result = null;
}

export function closeWordLookup() {
  wordLookupState.visible = false;
}

function lookupErrorMessage(error) {
  return (
    error?.response?.data?.msg ||
    (error?.code === 'ECONNABORTED' ? '查词超时，请稍后重试' : '查词失败，请重试')
  );
}

export async function openWordLookup({ word, sentence = '', anchor }) {
  const normalized = normalizeLookupWord(word);
  if (!normalized || !anchor) return;

  const seq = ++requestSeq;
  wordLookupState.visible = true;
  wordLookupState.anchor = anchor;
  wordLookupState.word = normalized;
  wordLookupState.sentence = typeof sentence === 'string' ? sentence : '';
  wordLookupState.adding = false;
  wordLookupState.error = '';

  const cached = cache.get(normalized);
  if (cached) {
    wordLookupState.result = cached;
    wordLookupState.loading = false;
    return;
  }

  wordLookupState.result = null;
  wordLookupState.loading = true;
  try {
    const response = await lookupWord(normalized, loadAiSettings(), {
      sentence: wordLookupState.sentence,
    });
    if (seq !== requestSeq) return;
    const data = response?.data;
    if (!data?.word || !data?.meaning) {
      wordLookupState.error = '查词结果无效，请重试';
      return;
    }
    cache.set(normalized, data);
    wordLookupState.result = data;
  } catch (error) {
    if (seq !== requestSeq) return;
    wordLookupState.result = null;
    wordLookupState.error = lookupErrorMessage(error);
  } finally {
    if (seq === requestSeq) wordLookupState.loading = false;
  }
}

export async function addLookupWordToLibrary() {
  const result = wordLookupState.result;
  if (!result?.meaning || result.source === 'library' || wordLookupState.adding) return null;

  wordLookupState.adding = true;
  wordLookupState.error = '';
  try {
    const response = await createWord({
      name: result.word,
      meaning: result.meaning,
      phonetic: result.phonetic || '',
    });
    const saved = {
      ...result,
      source: 'library',
      wordId: response?.data?.id ?? null,
    };
    cache.set(result.word, saved);
    if (wordLookupState.word === result.word) {
      wordLookupState.result = saved;
    }
    return saved;
  } catch (error) {
    wordLookupState.error = error?.response?.data?.msg || '加入词库失败';
    return null;
  } finally {
    wordLookupState.adding = false;
  }
}
