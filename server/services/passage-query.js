import { Op, literal } from 'sequelize';

import sequelize from '../config/database.js';
import { Passage, PassageReview } from '../models/index.js';
import { PASSAGE_MASTERED_STAGE, PASSAGE_STATUS, derivePassageStatus } from './passage-review.js';

/** 与 derivePassageStatus 保持同一套判定，下推到 SQL 做筛选。 */
export const buildStatusWhere = (status, today) => {
  if (status === PASSAGE_STATUS.ARCHIVED) return { archived: true };
  const active = { archived: false };
  switch (status) {
    case PASSAGE_STATUS.UNREAD:
      return { ...active, '$review.id$': null };
    case PASSAGE_STATUS.DUE:
      return { ...active, '$review.due_date$': { [Op.lte]: today } };
    case PASSAGE_STATUS.MASTERED:
      return {
        ...active,
        '$review.due_date$': { [Op.gt]: today },
        '$review.stage$': { [Op.gte]: PASSAGE_MASTERED_STAGE },
      };
    case PASSAGE_STATUS.LEARNING:
      return {
        ...active,
        '$review.due_date$': { [Op.gt]: today },
        '$review.stage$': { [Op.lt]: PASSAGE_MASTERED_STAGE },
      };
    default:
      return {};
  }
};

const reviewInclude = (userId) => ({
  model: PassageReview,
  as: 'review',
  where: { userId },
  required: false,
});

/**
 * 未读 > 待重读 > 熟练 > 学习中 > 归档。
 * 待重读按到期日从早到晚，其余按最近更新。
 */
export const buildPassageListOrder = (today) => {
  const day = sequelize.escape(today);
  const statusRank = literal(`CASE
    WHEN \`Passage\`.\`archived\` = 1 THEN 4
    WHEN \`review\`.\`id\` IS NULL THEN 0
    WHEN \`review\`.\`due_date\` <= ${day} THEN 1
    WHEN \`review\`.\`stage\` >= ${PASSAGE_MASTERED_STAGE} THEN 2
    ELSE 3
  END`);
  const dueRank = literal(`CASE
    WHEN \`Passage\`.\`archived\` = 0
      AND \`review\`.\`id\` IS NOT NULL
      AND \`review\`.\`due_date\` <= ${day}
    THEN \`review\`.\`due_date\`
    ELSE '9999-12-31'
  END`);
  return [
    [statusRank, 'ASC'],
    [dueRank, 'ASC'],
    ['update_time', 'DESC'],
    ['id', 'DESC'],
  ];
};

export const serializePassageNeighbor = (passage, today) => {
  if (!passage) return null;
  return {
    id: passage.id,
    title: passage.title,
    status: derivePassageStatus(passage.review, today, Boolean(passage.archived)),
  };
};

/** 按列表顺序取当前篇之后的下一篇，跳过归档。 */
export async function findNextPassage(userId, currentId, today) {
  const rows = await Passage.findAll({
    where: { userId, archived: false },
    attributes: ['id', 'title', 'archived'],
    include: [reviewInclude(userId)],
    order: buildPassageListOrder(today),
    subQuery: false,
  });
  const index = rows.findIndex((row) => row.id === Number(currentId));
  const next = index === -1 ? rows[0] : rows[index + 1];
  return serializePassageNeighbor(next || null, today);
}
