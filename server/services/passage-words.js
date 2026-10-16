import { sequelize, Word, WordRoot, Example, PassageSentence } from '../models/index.js';
import { ensureDefaultRoot } from '../utils/defaultRoot.js';
import { ensureWordReview } from '../utils/wordReview.js';
import { normalizeLookupWord } from './word-lookup.js';
import { PassageError, findOwnedPassage } from './passage-store.js';

const MAX_MEANING_LENGTH = 255;

const parseWordInput = ({ name, meaning, phonetic }) => {
  const normalizedName = normalizeLookupWord(name);
  if (!normalizedName) throw new PassageError('请选择合法的英文单词');
  if (meaning !== undefined && meaning !== null && typeof meaning !== 'string') {
    throw new PassageError('含义必须为字符串');
  }
  if (phonetic !== undefined && phonetic !== null && typeof phonetic !== 'string') {
    throw new PassageError('音标必须为字符串');
  }
  return {
    name: normalizedName,
    meaning: (meaning || '').trim().slice(0, MAX_MEANING_LENGTH),
    phonetic: (phonetic || '').trim() || null,
  };
};

/**
 * 从短文里把单词加入词库，并把所在句子写成该单词的例句。
 * 单词不存在时必须提供含义，新建后归入「未分类」；已存在时只补例句，同一句不重复写。
 */
export async function addWordFromPassage(userId, passageId, body = {}) {
  const passage = await findOwnedPassage(userId, passageId);
  const sentenceId = Number(body.sentenceId);
  if (!Number.isInteger(sentenceId) || sentenceId <= 0) throw new PassageError('缺少句子');
  const sentence = await PassageSentence.findOne({
    where: { id: sentenceId, passageId: passage.id },
  });
  if (!sentence) throw new PassageError('句子不存在', 404);

  const input = parseWordInput(body);

  return sequelize.transaction(async (transaction) => {
    let word = await Word.findOne({ where: { userId, name: input.name }, transaction });
    let wordCreated = false;

    if (!word) {
      if (!input.meaning) throw new PassageError('新单词需要提供含义');
      const defaultRoot = await ensureDefaultRoot(userId, { transaction });
      word = await Word.create(
        { userId, name: input.name, meaning: input.meaning, phonetic: input.phonetic },
        { transaction }
      );
      await WordRoot.create({ wordId: word.id, rootId: defaultRoot.id }, { transaction });
      await ensureWordReview(userId, word.id, { timezone: body.tz, transaction });
      wordCreated = true;
    }

    const existingExample = await Example.findOne({
      where: { wordId: word.id, sentence: sentence.text },
      transaction,
    });
    let exampleAdded = false;
    if (!existingExample) {
      await Example.create(
        {
          wordId: word.id,
          sentence: sentence.text,
          translation: sentence.translation || '',
          remark: `来自短文《${passage.title}》`,
        },
        { transaction }
      );
      exampleAdded = true;
    }

    return {
      word: { id: word.id, name: word.name, meaning: word.meaning, phonetic: word.phonetic },
      wordCreated,
      exampleAdded,
    };
  });
}
