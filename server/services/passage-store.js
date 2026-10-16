import { sequelize, Passage, PassageSentence, PassageReview } from '../models/index.js';
import {
  MAX_CONTENT_LENGTH,
  MAX_SENTENCES,
  MAX_TITLE_LENGTH,
  alignTranslations,
  carryOverTranslations,
  splitPassage,
} from './passage-splitter.js';
import { derivePassageStatus } from './passage-review.js';

export const PASSAGE_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const PASSAGE_SOURCES = Object.freeze(['manual', 'ai']);
export const MAX_TRANSLATION_LENGTH = 16000;
export const MAX_SENTENCE_TRANSLATION_LENGTH = 1000;
const MAX_TOPIC_LENGTH = 60;

export class PassageError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'PassageError';
    this.statusCode = statusCode;
  }
}

const optionalTrimmed = (value, label, maxLength) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new PassageError(`${label}必须为字符串`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new PassageError(`${label}不能超过 ${maxLength} 个字符`);
  return trimmed || null;
};

const parseSentenceTranslations = (value) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_SENTENCES) {
    throw new PassageError('逐句译文格式不正确');
  }
  return value.map((item) => {
    if (!item || typeof item.text !== 'string') throw new PassageError('逐句译文格式不正确');
    const translation = optionalTrimmed(
      item.translation,
      '单句译文',
      MAX_SENTENCE_TRANSLATION_LENGTH
    );
    return { text: item.text.trim(), translation };
  });
};

/**
 * 校验并规范化短文写入参数。
 * translation 是整篇译文；sentenceTranslations 是 AI 预览给出的逐句译文，按原句文本匹配。
 */
export function parsePassageInput(body = {}) {
  const { title, content, level } = body;
  if (typeof title !== 'string' || !title.trim()) throw new PassageError('标题为必填项');
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new PassageError(`标题不能超过 ${MAX_TITLE_LENGTH} 个字符`);
  }
  if (typeof content !== 'string' || !content.trim()) throw new PassageError('正文为必填项');
  if (content.trim().length > MAX_CONTENT_LENGTH) {
    throw new PassageError(`正文不能超过 ${MAX_CONTENT_LENGTH} 个字符`);
  }

  const normalizedLevel = level === undefined || level === null || level === '' ? null : level;
  if (normalizedLevel !== null && !PASSAGE_LEVELS.includes(normalizedLevel)) {
    throw new PassageError('难度只能是 A1 到 C2');
  }

  const source = body.source ?? 'manual';
  if (!PASSAGE_SOURCES.includes(source)) throw new PassageError('来源不正确');

  return {
    title: title.trim(),
    content,
    level: normalizedLevel,
    source,
    topic: optionalTrimmed(body.topic, '主题', MAX_TOPIC_LENGTH),
    translation: optionalTrimmed(body.translation, '译文', MAX_TRANSLATION_LENGTH),
    sentenceTranslations: parseSentenceTranslations(body.sentenceTranslations),
  };
}

const splitOrThrow = (content) => {
  const split = splitPassage(content);
  if (split.sentences.length === 0 || split.wordCount === 0) {
    throw new PassageError('正文中没有可识别的英文句子');
  }
  if (split.sentences.length > MAX_SENTENCES) {
    throw new PassageError(`正文最多 ${MAX_SENTENCES} 句，当前 ${split.sentences.length} 句`);
  }
  return split;
};

/** 按优先级决定每句译文：整篇译文 > AI 逐句译文 > 旧句子中原文相同的译文。 */
const buildSentenceRows = (split, { translation, sentenceTranslations, previousSentences }) => {
  if (translation) {
    const { translations, aligned } = alignTranslations(split.sentences.length, translation);
    return {
      rows: split.sentences.map((s, i) => ({ ...s, translation: translations[i] })),
      translationAligned: aligned,
    };
  }
  const source = sentenceTranslations || previousSentences || [];
  return { rows: carryOverTranslations(split.sentences, source), translationAligned: true };
};

const insertSentences = (passageId, rows, transaction) =>
  PassageSentence.bulkCreate(
    rows.map((row) => ({
      passageId,
      orderIndex: row.orderIndex,
      paragraphIndex: row.paragraphIndex,
      text: row.text,
      translation: row.translation,
    })),
    { transaction }
  );

export async function createPassage(userId, input) {
  const split = splitOrThrow(input.content);
  const { rows, translationAligned } = buildSentenceRows(split, input);

  const passage = await sequelize.transaction(async (transaction) => {
    const created = await Passage.create(
      {
        userId,
        title: input.title,
        content: split.content,
        level: input.level,
        source: input.source,
        topic: input.topic,
        wordCount: split.wordCount,
        sentenceCount: rows.length,
      },
      { transaction }
    );
    await insertSentences(created.id, rows, transaction);
    return created;
  });

  return { passage, translationAligned };
}

export async function findOwnedPassage(userId, id, options = {}) {
  const passage = await Passage.findOne({ where: { id, userId }, ...options });
  if (!passage) throw new PassageError('短文不存在', 404);
  return passage;
}

/** 正文变化或提供了整篇译文时重新分句；否则只更新标题和难度。 */
export async function updatePassage(userId, id, input) {
  return sequelize.transaction(async (transaction) => {
    const passage = await findOwnedPassage(userId, id, { transaction });
    const split = splitOrThrow(input.content);
    const needsResplit = split.content !== passage.content || Boolean(input.translation);
    let translationAligned = true;

    if (needsResplit) {
      const previousSentences = await PassageSentence.findAll({
        where: { passageId: passage.id },
        order: [['orderIndex', 'ASC']],
        transaction,
      });
      const built = buildSentenceRows(split, { ...input, previousSentences });
      translationAligned = built.translationAligned;
      await PassageSentence.destroy({ where: { passageId: passage.id }, transaction });
      await insertSentences(passage.id, built.rows, transaction);
    }

    await passage.update(
      {
        title: input.title,
        level: input.level,
        content: split.content,
        wordCount: split.wordCount,
        sentenceCount: split.sentences.length,
      },
      { transaction }
    );
    return { passage, translationAligned };
  });
}

export const serializeReview = (review) =>
  review
    ? {
        stage: review.stage,
        readCount: review.readCount,
        lastRating: review.lastRating,
        lastReadAt: review.lastReadAt,
        dueDate: review.dueDate,
      }
    : null;

export const serializeSentence = (sentence) => ({
  id: sentence.id,
  orderIndex: sentence.orderIndex,
  paragraphIndex: sentence.paragraphIndex,
  text: sentence.text,
  translation: sentence.translation,
});

export async function loadPassageDetail(userId, id, today) {
  const passage = await findOwnedPassage(userId, id);
  const [sentences, review] = await Promise.all([
    PassageSentence.findAll({ where: { passageId: passage.id }, order: [['orderIndex', 'ASC']] }),
    PassageReview.findOne({ where: { userId, passageId: passage.id } }),
  ]);

  return {
    id: passage.id,
    title: passage.title,
    content: passage.content,
    level: passage.level,
    source: passage.source,
    topic: passage.topic,
    wordCount: passage.wordCount,
    sentenceCount: passage.sentenceCount,
    createTime: passage.create_time,
    updateTime: passage.update_time,
    sentences: sentences.map(serializeSentence),
    review: serializeReview(review),
    status: derivePassageStatus(review, today),
  };
}
