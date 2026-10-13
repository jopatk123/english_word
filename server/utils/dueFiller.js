import { Op, literal } from 'sequelize';
import { WordReview } from '../models/index.js';
import { REVIEW_STATUS } from './srs.js';

// 当「今日到期 + 超期」数量少于「学习中」单词的 1/3 时，
// 从学习中单词里补足到至少 1/3，优先选取最近复习时间更早的单词。
export const MIN_DUE_RATIO = 1 / 3;

// 防饿死：即使真到期已经达到下限，仍为久未复习的非 known 单词保留一小段名额。
// 超过该天数未复习（或从未复习）才有资格进入这段名额。
export const STALE_AFTER_DAYS = 21;
// 名额约为最小 due 数量的 15%，至少 1 个、最多 10 个，避免把当天队列灌满。
export const GUARDRAIL_RATIO = 0.15;
export const GUARDRAIL_MIN = 1;
export const GUARDRAIL_MAX = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 补足 / 防饿死 / 已掌握复习共用：最近复习时间越早越优先（未复习过的视为最早）。
export const ORDER_BY_OLDEST_REVIEW = [
  [literal("COALESCE(last_reviewed_at, '1970-01-01T00:00:00.000Z')"), 'ASC'],
  ['easeFactor', 'ASC'],
  ['id', 'ASC'],
];

// 学习中单词数 = 总单词数 - 已掌握单词数（与 stats.js 的口径保持一致）
export async function countLearning(userId) {
  const [total, known] = await Promise.all([
    WordReview.count({ where: { userId } }),
    WordReview.count({ where: { userId, status: REVIEW_STATUS.KNOWN } }),
  ]);
  return Math.max(total - known, 0);
}

// 计算补足后应有的最小 due 数量：ceil(learningCount / 3)
// learningCount 为 0 时返回 0，避免空词库也强制塞词
export function computeMinDueCount(learningCount) {
  if (learningCount <= 0) return 0;
  return Math.ceil(learningCount * MIN_DUE_RATIO);
}

// 防饿死名额。minDue 为 0（没有学习中单词）时不保留名额。
export function computeGuardrailCount(minDueCount) {
  if (minDueCount <= 0) return 0;
  const raw = Math.ceil(minDueCount * GUARDRAIL_RATIO);
  return Math.min(GUARDRAIL_MAX, Math.max(GUARDRAIL_MIN, raw));
}

export function staleReviewedBefore(now = new Date(), days = STALE_AFTER_DAYS) {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

// scope=due 的真到期条件：超期，或今天到期且 dueAt 已到（dueAt 为空视为已到）。
export function buildScopeDueWhere(userId, today, now) {
  return {
    userId,
    [Op.or]: [
      { dueDate: { [Op.lt]: today } },
      {
        dueDate: today,
        [Op.or]: [{ dueAt: null }, { dueAt: { [Op.lte]: now } }],
      },
    ],
  };
}

function buildNonKnownCandidateWhere(userId, excludeIds) {
  return {
    userId,
    status: { [Op.ne]: REVIEW_STATUS.KNOWN },
    ...(excludeIds.length > 0 ? { id: { [Op.notIn]: excludeIds } } : {}),
  };
}

function buildStaleLastReviewedClause(now) {
  return {
    [Op.or]: [{ lastReviewedAt: null }, { lastReviewedAt: { [Op.lt]: staleReviewedBefore(now) } }],
  };
}

async function findCandidateIds(where, limit) {
  if (limit <= 0) return [];
  const rows = await WordReview.findAll({
    where,
    attributes: ['id'],
    order: ORDER_BY_OLDEST_REVIEW,
    limit,
  });
  return rows.map((row) => row.id);
}

/**
 * scope=due 的复习池 id，顺序固定：
 * 1. 真到期（调用方传入的 dueWhere + dueOrder）
 * 2. 补足：真到期不足 ceil(learning/3) 时，从其余非 known 里按最久未复习补到该下限
 * 3. 防饿死：在前两段之外，再加入最多 computeGuardrailCount 个
 *    「超过 STALE_AFTER_DAYS 天未复习」的非 known（同样最久未复习优先）
 * known 不会进入第 2、3 段。
 */
export async function collectDuePoolIds({ userId, dueWhere, dueOrder, now = new Date() }) {
  const dueIdRows = await WordReview.findAll({
    where: dueWhere,
    attributes: ['id'],
    order: dueOrder,
  });
  const dueIds = dueIdRows.map((row) => row.id);

  const learningCount = await countLearning(userId);
  const minDueCount = computeMinDueCount(learningCount);
  const fillerNeed = Math.max(0, minDueCount - dueIds.length);
  const fillerIds = await findCandidateIds(buildNonKnownCandidateWhere(userId, dueIds), fillerNeed);

  const guardrailBudget = computeGuardrailCount(minDueCount);
  const guardrailIds = await findCandidateIds(
    {
      ...buildNonKnownCandidateWhere(userId, [...dueIds, ...fillerIds]),
      ...buildStaleLastReviewedClause(now),
    },
    guardrailBudget
  );

  return [...dueIds, ...fillerIds, ...guardrailIds];
}
