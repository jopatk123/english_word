import { getAiExampleSuggestions } from '../api/index.js';

/**
 * 例句「重新生成」通用逻辑。
 *
 * 单词详情页与背单词学习会话共用同一套流程：
 * 调用 AI 生成候选例句 → 剔除与现有例句重复的候选 → 返回一条可替换例句。
 */

const normalizeSentence = (sentence) => `${sentence || ''}`.trim().toLowerCase();

/** 汇总去重后的例句原文列表（用于告知 AI 需要避开哪些句子） */
export const collectExcludedSentences = (...sentenceLists) => {
  const sentences = sentenceLists.flat().filter(Boolean);
  return [...new Set(sentences)];
};

/**
 * 请求一条与现有例句不重复的替换例句。
 *
 * @param {object} params
 * @param {number|string} params.wordId - 目标单词 ID
 * @param {string[]} [params.existingSentences] - 当前单词已有例句原文，需全部避开
 * @param {object} params.config - AI 配置
 * @param {number} [params.maxAttempts] - 最多请求次数（AI 可能返回全部重复的候选）
 * @returns {Promise<{sentence: string, translation: string}|null>} 找不到不重复候选时返回 null
 */
export const requestReplacementExample = async ({
  wordId,
  existingSentences = [],
  config,
  maxAttempts = 2,
}) => {
  const existingSet = new Set(existingSentences.filter(Boolean).map(normalizeSentence));
  let excludedSentences = collectExcludedSentences(existingSentences);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await getAiExampleSuggestions(wordId, config, { excludedSentences });
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    const candidate = items.find(
      (item) =>
        item?.sentence && item?.translation && !existingSet.has(normalizeSentence(item.sentence))
    );

    if (candidate) return candidate;

    // 本轮候选全部重复时，把它们一并加入排除列表后重试
    excludedSentences = collectExcludedSentences(
      existingSentences,
      items.map((item) => item?.sentence)
    );
  }

  return null;
};
