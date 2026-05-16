/**
 * AI 响应净化工具函数
 *
 * 将 AI 原始响应中的词根、单词、例句建议标准化为受信任的结构体，
 * 防止不合规字段写入数据库。
 */

const VALID_POS_TYPES = new Set([
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'pron.',
  'conj.',
  'interj.',
  'num.',
  'art.',
  'aux.',
]);

function trimText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export const sanitizeRootSuggestions = (items, existingNames = []) => {
  const nameSet = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const name = trimText(item?.name, 40).toLowerCase();
    const meaning = trimText(item?.meaning, 80);

    if (!/^[a-z-]{2,40}$/.test(name) || !meaning) {
      continue;
    }
    if (nameSet.has(name)) {
      continue;
    }

    nameSet.add(name);
    result.push({ name, meaning });
    if (result.length >= 10) break;
  }

  return result;
};

export const sanitizeWordSuggestions = (items, existingNames = []) => {
  const nameSet = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const name = trimText(item?.name, 60).toLowerCase();
    const meaning = trimText(item?.meaning, 120);
    const phonetic = trimText(item?.phonetic || '', 80);

    if (!/^[a-z][a-z-]{1,59}$/.test(name) || !meaning) {
      continue;
    }
    if (nameSet.has(name)) {
      continue;
    }

    const posItems = Array.isArray(item?.partOfSpeech) ? item.partOfSpeech : [];
    const partOfSpeech = [];
    for (const pos of posItems) {
      const type = (pos?.type || '').trim().toLowerCase();
      const posMeaning = trimText(pos?.meaning || '', 160);
      if (VALID_POS_TYPES.has(type) && posMeaning) {
        partOfSpeech.push({ type, meaning: posMeaning });
        if (partOfSpeech.length >= 8) break;
      }
    }

    nameSet.add(name);
    result.push({ name, meaning, phonetic, partOfSpeech });
    if (result.length >= 12) break;
  }

  return result;
};

export const sanitizeExampleSuggestions = (items, existingSentences = []) => {
  const sentenceSet = new Set(existingSentences.map((sentence) => sentence.trim().toLowerCase()));
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const sentence = trimText(item?.sentence, 400);
    const translation = trimText(item?.translation, 240);
    const normalizedSentence = sentence.toLowerCase();

    if (!sentence || !translation || sentence.length < 8) {
      continue;
    }
    if (sentenceSet.has(normalizedSentence)) {
      continue;
    }

    sentenceSet.add(normalizedSentence);
    result.push({ sentence, translation });
    if (result.length >= 8) break;
  }

  return result;
};
