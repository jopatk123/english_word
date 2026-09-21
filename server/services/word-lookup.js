import { Word, WordLookup } from '../models/index.js';

const LOOKUP_WORD_PATTERN = /^[a-z]+(?:[-'][a-z]+)*$/;

/**
 * 把用户点中的词规范成可查询、可缓存的形式。
 * 所有格 's 会去掉，缩写（don't）保留。
 */
export function normalizeLookupWord(raw) {
  if (typeof raw !== 'string') return '';
  let word = raw.trim().toLowerCase().replace(/’/g, "'");
  if (word.endsWith("'s")) word = word.slice(0, -2);
  if (!word || word.length > 60 || !LOOKUP_WORD_PATTERN.test(word)) return '';
  return word;
}

export function parsePartOfSpeech(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toLookupResponse(record, source) {
  const word = record.word || record.name;
  return {
    word,
    phonetic: record.phonetic || '',
    meaning: record.meaning,
    partOfSpeech: parsePartOfSpeech(record.partOfSpeech),
    source,
    wordId: source === 'library' ? record.id : null,
  };
}

export async function findLibraryLookup(userId, word) {
  return Word.findOne({ where: { name: word, userId } });
}

export async function findCachedLookup(userId, word) {
  return WordLookup.findOne({ where: { userId, word } });
}

export async function saveCachedLookup(userId, gloss) {
  try {
    return await WordLookup.create({
      userId,
      word: gloss.word,
      phonetic: gloss.phonetic || '',
      meaning: gloss.meaning,
      partOfSpeech: JSON.stringify(gloss.partOfSpeech || []),
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isUnique =
      error?.name === 'SequelizeUniqueConstraintError' ||
      message.includes('idx_word_lookups_user_word_unique');
    if (!isUnique) throw error;
    return WordLookup.findOne({ where: { userId, word: gloss.word } });
  }
}
