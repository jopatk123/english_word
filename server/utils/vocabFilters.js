import { Op, literal } from 'sequelize';
import { REVIEW_STATUS } from './srs.js';

export const WORD_REVIEW_STATUSES = new Set(Object.values(REVIEW_STATUS));

/** 当前 Word 行的例句数量（SQLite / Sequelize 主别名为 `Word`） */
export const WORD_EXAMPLE_COUNT_SQL =
  '(SELECT COUNT(*) FROM examples AS examples WHERE examples.word_id = `Word`.`id`)';

export function exampleCountLiteral() {
  return literal(WORD_EXAMPLE_COUNT_SQL);
}

export function buildExampleCountPredicate(minExamples, maxExamples) {
  const parts = [];
  if (Number.isFinite(minExamples)) {
    parts.push(`${WORD_EXAMPLE_COUNT_SQL} >= ${Math.trunc(minExamples)}`);
  }
  if (Number.isFinite(maxExamples)) {
    parts.push(`${WORD_EXAMPLE_COUNT_SQL} <= ${Math.trunc(maxExamples)}`);
  }
  if (!parts.length) return null;
  return literal(parts.join(' AND '));
}

export function buildOnlyDefaultRootPredicate(defaultRootId) {
  const id = Math.trunc(defaultRootId);
  return literal(`(
    SELECT COUNT(*) FROM word_roots AS wr WHERE wr.word_id = \`Word\`.\`id\`
  ) = 1 AND EXISTS (
    SELECT 1 FROM word_roots AS wr
    WHERE wr.word_id = \`Word\`.\`id\` AND wr.root_id = ${id}
  )`);
}

export function buildOrphanRootPredicate(userId, maxWordCount) {
  const uid = Math.trunc(userId);
  const cap = Math.trunc(maxWordCount);
  return literal(`(
    SELECT COUNT(*) FROM word_roots AS wr
    INNER JOIN words AS w ON w.id = wr.word_id AND w.user_id = ${uid}
    WHERE wr.root_id = \`Root\`.\`id\`
  ) <= ${cap}`);
}

export function applyHasImageFilter(where, hasImage) {
  if (hasImage === true) {
    where.imageExt = { [Op.ne]: null };
  } else if (hasImage === false) {
    where.imageExt = null;
  }
}

export function pushWhereAnd(where, predicate) {
  if (!predicate) return;
  if (!where[Op.and]) where[Op.and] = [];
  where[Op.and].push(predicate);
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 软检查：例句是否包含词条（大小写不敏感、按词边界）。
 * 仅用于审计报告，创建例句时不得据此 400。
 */
export function sentenceHasLemma(sentence, lemma) {
  const word = String(lemma || '').trim();
  if (!word) return true;
  const text = String(sentence || '');
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return pattern.test(text);
}
