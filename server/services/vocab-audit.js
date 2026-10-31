import { Op, fn, col, literal } from 'sequelize';
import { Word, Root, Example, WordRoot } from '../models/index.js';
import {
  WORD_EXAMPLE_COUNT_SQL,
  buildOnlyDefaultRootPredicate,
  sentenceHasLemma,
} from '../utils/vocabFilters.js';
import { clampInt } from '../utils/queryFlags.js';

const DEFAULT_MIN_EXAMPLES = 2;
const DEFAULT_SAMPLE_LIMIT = 20;
const MAX_SAMPLE_LIMIT = 50;

function toSample(rows) {
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function countAndSample(model, { where, order, limit }) {
  const [count, rows] = await Promise.all([
    model.count({ where }),
    model.findAll({
      where,
      attributes: ['id', 'name'],
      order,
      limit,
    }),
  ]);
  return { count, sample: toSample(rows) };
}

async function attachExampleCounts(sample) {
  const ids = sample.map((row) => row.id);
  if (!ids.length) return sample;
  const rows = await Example.findAll({
    attributes: ['wordId', [fn('COUNT', col('id')), 'exampleCount']],
    where: { wordId: ids },
    group: ['wordId'],
    raw: true,
  });
  const countByWord = Object.fromEntries(
    rows.map((row) => [row.wordId ?? row.word_id, Number(row.exampleCount)])
  );
  return sample.map((row) => ({ ...row, exampleCount: countByWord[row.id] || 0 }));
}

export async function buildVocabularyAudit(userId, query = {}) {
  const minExamples = clampInt(query.minExamples, {
    min: 0,
    max: 100,
    fallback: DEFAULT_MIN_EXAMPLES,
  });
  const sampleLimit = clampInt(query.sampleLimit, {
    min: 1,
    max: MAX_SAMPLE_LIMIT,
    fallback: DEFAULT_SAMPLE_LIMIT,
  });
  const lemmaCheck = query.lemmaCheck !== false;

  const defaultRoot = await Root.findOne({
    where: { userId, isDefault: true },
    attributes: ['id', 'name'],
  });

  const fewWhere = {
    userId,
    [Op.and]: [literal(`${WORD_EXAMPLE_COUNT_SQL} < ${minExamples}`)],
  };
  const missingMeaningWhere = {
    userId,
    [Op.and]: [literal("TRIM(COALESCE(`Word`.`meaning`, '')) = ''")],
  };
  const missingPhoneticWhere = {
    userId,
    [Op.or]: [{ phonetic: null }, { phonetic: '' }],
  };

  const onlyDefaultWhere = defaultRoot
    ? { userId, [Op.and]: [buildOnlyDefaultRootPredicate(defaultRoot.id)] }
    : null;

  const [
    wordTotal,
    rootTotal,
    exampleTotal,
    fewExamples,
    missingMeaning,
    missingPhonetic,
    noImage,
  ] = await Promise.all([
    Word.count({ where: { userId } }),
    Root.count({ where: { userId } }),
    Example.count({
      include: [{ model: Word, as: 'word', attributes: [], required: true, where: { userId } }],
    }),
    countAndSample(Word, {
      where: fewWhere,
      order: [['create_time', 'DESC']],
      limit: sampleLimit,
    }),
    countAndSample(Word, {
      where: missingMeaningWhere,
      order: [['create_time', 'DESC']],
      limit: sampleLimit,
    }),
    countAndSample(Word, {
      where: missingPhoneticWhere,
      order: [['create_time', 'DESC']],
      limit: sampleLimit,
    }),
    countAndSample(Word, {
      where: { userId, imageExt: null },
      order: [['create_time', 'DESC']],
      limit: sampleLimit,
    }),
  ]);

  fewExamples.sample = await attachExampleCounts(fewExamples.sample);

  let onlyDefaultRoot = { count: 0, sample: [] };
  if (onlyDefaultWhere) {
    onlyDefaultRoot = await countAndSample(Word, {
      where: onlyDefaultWhere,
      order: [['create_time', 'DESC']],
      limit: sampleLimit,
    });
  }

  const linkedRootRows = await WordRoot.findAll({
    attributes: ['rootId'],
    include: [{ model: Word, as: 'word', attributes: [], required: true, where: { userId } }],
  });
  const linkedRootIds = [...new Set(linkedRootRows.map((row) => row.rootId))];
  const orphanRoots = await countAndSample(Root, {
    where: {
      userId,
      isDefault: false,
      ...(linkedRootIds.length ? { id: { [Op.notIn]: linkedRootIds } } : {}),
    },
    order: [['name', 'ASC']],
    limit: sampleLimit,
  });

  let lemmaMissingInExamples = { count: 0, sample: [] };
  if (lemmaCheck) {
    const wordsWithExamples = await Word.findAll({
      where: { userId },
      attributes: ['id', 'name'],
      include: [{ model: Example, as: 'examples', attributes: ['sentence'], required: true }],
    });
    const flagged = [];
    for (const word of wordsWithExamples) {
      const missingInCount = (word.examples || []).filter(
        (ex) => !sentenceHasLemma(ex.sentence, word.name)
      ).length;
      if (missingInCount) {
        flagged.push({ id: word.id, name: word.name, missingInCount });
      }
    }
    lemmaMissingInExamples = {
      count: flagged.length,
      sample: flagged.slice(0, sampleLimit),
    };
  }

  return {
    totals: { words: wordTotal, roots: rootTotal, examples: exampleTotal },
    fewExamples: { count: fewExamples.count, minExamples, sample: fewExamples.sample },
    onlyDefaultRoot,
    orphanRoots: { count: orphanRoots.count, excludeDefault: true, sample: orphanRoots.sample },
    missingMeaning,
    missingPhonetic,
    noImage,
    lemmaMissingInExamples,
  };
}
