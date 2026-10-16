import { tokenizeSentence } from './sentenceTokens.js';

/** 按 paragraphIndex 把句子分组，保持原有顺序。 */
export function groupSentencesByParagraph(sentences = []) {
  const groups = [];
  let currentIndex = null;
  for (const sentence of sentences) {
    if (sentence.paragraphIndex !== currentIndex || groups.length === 0) {
      groups.push([]);
      currentIndex = sentence.paragraphIndex;
    }
    groups[groups.length - 1].push(sentence);
  }
  return groups;
}

const isDoubledConsonant = (stem) => /([b-df-hj-np-tv-z])\1$/.test(stem);

/**
 * 给出一个词可能的原形，用于和词库匹配（cats→cat、stopped→stop、making→make）。
 * 第一个元素总是词本身。
 */
export function lemmaCandidates(word) {
  const candidates = [word];
  const add = (candidate) => {
    if (candidate.length >= 2 && !candidates.includes(candidate)) candidates.push(candidate);
  };

  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) add(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1));

  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    add(stem);
    add(word.slice(0, -1));
    if (isDoubledConsonant(stem)) add(stem.slice(0, -1));
  }

  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    if (isDoubledConsonant(stem)) add(stem.slice(0, -1));
  }

  return candidates;
}

/** 收集短文中出现的所有可查询词（去重），附带它们的原形候选。 */
export function collectLookupCandidates(sentences = []) {
  const words = new Set();
  for (const sentence of sentences) {
    for (const token of tokenizeSentence(sentence.text)) {
      if (token.word) words.add(token.word);
    }
  }
  const candidates = new Set();
  for (const word of words) {
    for (const candidate of lemmaCandidates(word)) candidates.add(candidate);
  }
  return [...candidates];
}

/** 整篇译文没能逐句对齐时，服务端会把它整段放在第一句。 */
export function isTranslationMisaligned(sentences = []) {
  return (
    sentences.length > 1 &&
    Boolean(sentences[0].translation) &&
    sentences.slice(1).every((sentence) => !sentence.translation)
  );
}

export const countMissingTranslations = (sentences = []) =>
  sentences.filter((sentence) => !sentence.translation).length;
