import { markRaw, reactive } from 'vue';
import { addPassageWord, createWord, lookupWord } from '../api/index.js';
import { loadAiSettings } from '../utils/aiSettings.js';
import { normalizeLookupWord } from '../utils/sentenceTokens.js';

const cache = new Map();
let requestSeq = 0;

export const wordLookupState = reactive({
  visible: false,
  anchor: null,
  word: '',
  sentence: '',
  // 短文页传入 { passageId, sentenceId, onAdded }：加词时顺带把所在句写成例句
  context: null,
  loading: false,
  adding: false,
  exampleSaved: false,
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
  wordLookupState.context = null;
  wordLookupState.loading = false;
  wordLookupState.adding = false;
  wordLookupState.exampleSaved = false;
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

export async function openWordLookup({ word, sentence = '', anchor, context = null }) {
  const normalized = normalizeLookupWord(word);
  if (!normalized || !anchor) return;

  const seq = ++requestSeq;
  wordLookupState.visible = true;
  wordLookupState.anchor = anchor;
  wordLookupState.word = normalized;
  wordLookupState.sentence = typeof sentence === 'string' ? sentence : '';
  wordLookupState.context = context ? markRaw(context) : null;
  wordLookupState.adding = false;
  wordLookupState.exampleSaved = false;
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

const saveViaPassage = async (context, result) => {
  const response = await addPassageWord(context.passageId, {
    name: result.word,
    meaning: result.meaning,
    phonetic: result.phonetic || '',
    sentenceId: context.sentenceId,
  });
  wordLookupState.exampleSaved = true;
  return response?.data?.word?.id ?? null;
};

export async function addLookupWordToLibrary() {
  const result = wordLookupState.result;
  if (!result?.meaning || result.source === 'library' || wordLookupState.adding) return null;

  const context = wordLookupState.context;
  wordLookupState.adding = true;
  wordLookupState.error = '';
  try {
    let wordId;
    if (context?.passageId) {
      wordId = await saveViaPassage(context, result);
    } else {
      const response = await createWord({
        name: result.word,
        meaning: result.meaning,
        phonetic: result.phonetic || '',
      });
      wordId = response?.data?.id ?? null;
    }
    const saved = { ...result, source: 'library', wordId };
    cache.set(result.word, saved);
    if (wordLookupState.word === result.word) {
      wordLookupState.result = saved;
    }
    context?.onAdded?.(saved);
    return saved;
  } catch (error) {
    wordLookupState.error = error?.response?.data?.msg || '加入词库失败';
    return null;
  } finally {
    wordLookupState.adding = false;
  }
}

/** 词库里已有这个词时，只把当前短文句子补成它的例句。 */
export async function addLookupSentenceAsExample() {
  const result = wordLookupState.result;
  const context = wordLookupState.context;
  if (
    result?.source !== 'library' ||
    !context?.passageId ||
    wordLookupState.adding ||
    wordLookupState.exampleSaved
  ) {
    return false;
  }

  wordLookupState.adding = true;
  wordLookupState.error = '';
  try {
    await saveViaPassage(context, result);
    return true;
  } catch (error) {
    wordLookupState.error = error?.response?.data?.msg || '保存例句失败';
    return false;
  } finally {
    wordLookupState.adding = false;
  }
}
