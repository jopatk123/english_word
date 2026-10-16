import { ref, unref } from 'vue';
import { lookupWordStatuses } from '../api/index.js';
import { collectLookupCandidates, lemmaCandidates } from '../utils/passageText.js';

const STATUS_LOOKUP_BATCH = 500;
const HIGHLIGHT_STATUSES = new Set(['new', 'learning', 'review']);

/**
 * 查询短文中出现的词在个人词库里的状态。
 * 词形变化按 lemmaCandidates 回退匹配（cats 命中 cat）。
 */
export function useVocabHighlight(sentencesSource) {
  const statuses = ref({});
  let loadSeq = 0;

  const load = async () => {
    const seq = ++loadSeq;
    const candidates = collectLookupCandidates(unref(sentencesSource) || []);
    const next = {};
    try {
      for (let start = 0; start < candidates.length; start += STATUS_LOOKUP_BATCH) {
        const res = await lookupWordStatuses(candidates.slice(start, start + STATUS_LOOKUP_BATCH));
        Object.assign(next, res?.data?.items || {});
      }
    } catch {
      // 高亮只是辅助信息，查询失败时按“都不在词库”处理
    }
    if (seq === loadSeq) statuses.value = next;
  };

  const statusOf = (word) => {
    if (!word) return null;
    for (const candidate of lemmaCandidates(word)) {
      const entry = statuses.value[candidate];
      if (entry) return entry.status;
    }
    return null;
  };

  const wordClass = (word) => (HIGHLIGHT_STATUSES.has(statusOf(word)) ? 'is-vocab-learning' : '');

  const markAdded = (word) => {
    if (!word || statuses.value[word]) return;
    statuses.value = { ...statuses.value, [word]: { wordId: null, status: 'new' } };
  };

  return { statuses, load, statusOf, wordClass, markAdded };
}
