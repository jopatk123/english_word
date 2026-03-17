import { Root } from '../models/index.js';

export const DEFAULT_ROOT_NAME = '未分类';
export const DEFAULT_ROOT_MEANING = '无明确词根来源的单词';

/**
 * 为指定用户找到或自动创建「未分类」默认词根。
 * 幂等操作：多次调用只会创建一次。
 * @param {number} userId
 * @returns {Promise<Root>}
 */
export async function ensureDefaultRoot(userId) {
  const [root] = await Root.findOrCreate({
    where: { userId, isDefault: true },
    defaults: {
      name: DEFAULT_ROOT_NAME,
      meaning: DEFAULT_ROOT_MEANING,
      isDefault: true,
      userId,
    },
  });
  return root;
}
