import { Op } from 'sequelize';
import { sequelize, Word, WordReview, PassageSentence } from '../models/index.js';
import { REVIEW_STATUS } from '../utils/srs.js';
import {
  MAX_CONTENT_LENGTH,
  MAX_SENTENCES,
  splitPassage,
  splitSentences,
} from './passage-splitter.js';
import { PassageError, findOwnedPassage, serializeSentence } from './passage-store.js';
import {
  buildTranslateSentencesPrompt,
  sanitizeSentenceTranslations,
} from '../utils/aiPassagePrompts.js';

export const TARGET_WORD_LIMIT = 8;
const TRANSLATE_CHUNK_SIZE = 40;

/** 从未掌握、未暂停的单词里随机挑选，用作 AI 生成短文的目标词。 */
export async function pickLearningWords(userId, limit = TARGET_WORD_LIMIT) {
  const reviews = await WordReview.findAll({
    where: { userId, status: { [Op.ne]: REVIEW_STATUS.KNOWN }, paused: false },
    include: [{ model: Word, as: 'word', attributes: ['name'], where: { userId } }],
    order: sequelize.random(),
    limit,
  });
  return reviews.map((review) => review.word.name);
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 目标词按前缀匹配（cat 能匹配 cats），只认可正文里真实出现的。 */
export function findUsedWords(content, targetWords) {
  return targetWords.filter((word) =>
    new RegExp(`\\b${escapeRegExp(word)}`, 'i').test(String(content || ''))
  );
}

/**
 * 把 AI 生成的段落转成和保存时一致的分句结果。
 * AI 给出的一句若被拆成多句，译文挂在第一段上，后面的留空。
 */
export function buildGeneratedPreview(generated, { topic, level, targetWords }) {
  const content = generated.paragraphs
    .map((paragraph) => paragraph.map((item) => item.en).join(' '))
    .join('\n\n');
  const split = splitPassage(content);
  if (split.content.length > MAX_CONTENT_LENGTH || split.sentences.length > MAX_SENTENCES) {
    throw new PassageError('AI 返回的短文过长，请重试或选择更短的长度');
  }

  const translationPool = new Map();
  for (const item of generated.paragraphs.flat()) {
    splitSentences(item.en).forEach((piece, index) => {
      if (index === 0 && item.zh && !translationPool.has(piece))
        translationPool.set(piece, item.zh);
    });
  }

  return {
    title: generated.title || topic || 'Untitled',
    level,
    topic: topic || null,
    content: split.content,
    wordCount: split.wordCount,
    sentences: split.sentences.map((sentence) => ({
      ...sentence,
      translation: translationPool.get(sentence.text) || null,
    })),
    targetWords,
    usedWords: findUsedWords(split.content, targetWords),
  };
}

/**
 * 只翻译还没有译文的句子，按顺序分批请求，结果直接写回数据库。
 * @param {(prompts: object) => Promise<unknown>} requestJson 已绑定用户配置的 AI 请求函数
 */
export async function translateMissingSentences(userId, passageId, requestJson) {
  const passage = await findOwnedPassage(userId, passageId);
  const sentences = await PassageSentence.findAll({
    where: { passageId: passage.id },
    order: [['orderIndex', 'ASC']],
  });
  const missing = sentences.filter((sentence) => !sentence.translation);

  let translatedCount = 0;
  for (let start = 0; start < missing.length; start += TRANSLATE_CHUNK_SIZE) {
    const chunk = missing.slice(start, start + TRANSLATE_CHUNK_SIZE);
    const items = chunk.map((sentence) => ({ i: sentence.orderIndex, text: sentence.text }));
    const payload = await requestJson(buildTranslateSentencesPrompt(passage.title, items));
    const translations = sanitizeSentenceTranslations(
      payload,
      items.map((item) => item.i)
    );
    for (const sentence of chunk) {
      const translation = translations.get(sentence.orderIndex);
      if (!translation) continue;
      await sentence.update({ translation });
      translatedCount += 1;
    }
  }

  if (missing.length && translatedCount === 0) {
    throw new PassageError('AI 返回的译文无效，请重试');
  }

  return {
    sentences: sentences.map(serializeSentence),
    translatedCount,
    missingCount: missing.length - translatedCount,
  };
}
