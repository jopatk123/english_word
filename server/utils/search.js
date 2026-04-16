import { Op } from 'sequelize';

export const buildKeywordSearch = (keyword, fields = ['name']) => {
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : '';

  if (!normalizedKeyword || fields.length === 0) {
    return {};
  }

  return {
    [Op.or]: fields.map((field) => ({
      [field]: {
        [Op.substring]: normalizedKeyword,
      },
    })),
  };
};