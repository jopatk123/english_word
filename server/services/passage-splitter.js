export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_SENTENCES = 200;

// Intl.Segmenter 会在这些称谓缩写后误切句，需要把它和后一段合并。
const TITLE_ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'st',
  'sr',
  'jr',
  'mt',
  'gen',
  'capt',
  'lt',
  'col',
  'sgt',
  'rev',
  'no',
  'vs',
]);

const SENTENCE_END_RE = /[.!?…]["'”’)\]]*$/;
const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

const collapseSpaces = (text) => text.replace(/[ \t\u00a0]+/g, ' ').trim();

export function countWords(text) {
  return (String(text || '').match(WORD_RE) || []).length;
}

/**
 * 规范化正文并切成段落。
 * 空行一定是段落边界；单个换行只有在上一行以句末标点结束时才算段落边界，
 * 否则视为排版折行（例如从 PDF 复制）并与下一行合并。
 */
export function splitParagraphs(content) {
  const lines = String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(collapseSpaces);

  const paragraphs = [];
  let current = '';
  for (const line of lines) {
    if (!line) {
      if (current) paragraphs.push(current);
      current = '';
      continue;
    }
    if (!current) {
      current = line;
    } else if (SENTENCE_END_RE.test(current)) {
      paragraphs.push(current);
      current = line;
    } else {
      current = `${current} ${line}`;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

const endsWithAbbreviation = (segment) => {
  const match = segment.match(/(?:^|\s)([A-Za-z]+)\.$/);
  if (!match) return false;
  const token = match[1];
  return TITLE_ABBREVIATIONS.has(token.toLowerCase()) || /^[A-Z]$/.test(token);
};

export function splitSentences(paragraph) {
  const sentences = [];
  for (const { segment } of segmenter.segment(String(paragraph || ''))) {
    const text = segment.trim();
    if (!text) continue;
    const last = sentences.length - 1;
    if (last >= 0 && endsWithAbbreviation(sentences[last])) {
      sentences[last] = `${sentences[last]} ${text}`;
    } else {
      sentences.push(text);
    }
  }
  return sentences;
}

/**
 * 把正文切成带段落下标的句子列表，并给出规范化后的正文（段落以空行分隔）。
 */
export function splitPassage(content) {
  const paragraphs = splitParagraphs(content);
  const sentences = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const text of splitSentences(paragraph)) {
      sentences.push({ orderIndex: sentences.length, paragraphIndex, text });
    }
  });

  return {
    content: paragraphs.join('\n\n'),
    sentences,
    wordCount: countWords(paragraphs.join(' ')),
  };
}

/** 中文译文按句末标点和换行切分，句末的右引号/括号跟随前一句。 */
export function splitTranslation(text) {
  return (
    String(text || '')
      .replace(/\r\n?/g, '\n')
      .match(/[^。！？!?\n]+(?:[。！？!?]+[”"』」）)]*)?|[。！？!?]+/g) || []
  )
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 把整篇译文对齐到句子上。句数一致时逐句对应；
 * 否则整段译文放进第一句，其余留空，并标记 aligned=false。
 */
export function alignTranslations(sentenceCount, translationText) {
  const trimmed = String(translationText || '').trim();
  if (!trimmed || sentenceCount === 0) {
    return { translations: Array(sentenceCount).fill(null), aligned: true };
  }

  const parts = splitTranslation(trimmed);
  if (parts.length === sentenceCount) {
    return { translations: parts, aligned: true };
  }

  const translations = Array(sentenceCount).fill(null);
  translations[0] = trimmed.replace(/\s*\n\s*/g, ' ');
  return { translations, aligned: false };
}

/** 重新分句后，原文完全相同的句子沿用旧译文（同文多句按出现顺序逐一匹配）。 */
export function carryOverTranslations(newSentences, oldSentences) {
  const pool = new Map();
  for (const old of oldSentences) {
    if (!old.translation) continue;
    const queue = pool.get(old.text) || [];
    queue.push(old.translation);
    pool.set(old.text, queue);
  }

  return newSentences.map((sentence) => {
    const queue = pool.get(sentence.text);
    return { ...sentence, translation: queue?.length ? queue.shift() : null };
  });
}
