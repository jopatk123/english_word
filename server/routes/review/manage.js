import { Router } from 'express';
import { Word, Root, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { REVIEW_STATUS } from '../../utils/srs.js';

const router = Router();

// 获取词根列表及其掌握进度
router.get('/roots-progress', async (req, res) => {
  try {
    const roots = await Root.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: Word,
          as: 'words',
          through: { attributes: [] },
          attributes: ['id'],
          where: { userId: req.userId },
          required: false,
          include: [
            {
              model: WordReview,
              as: 'reviews',
              where: { userId: req.userId },
              required: false,
              attributes: ['status'],
            },
          ],
        },
      ],
      // 「未分类」默认词根排在最前，其余词根按词根名称首字母升序排列
      order: [
        ['is_default', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    const result = roots.map((r) => {
      const wordCount = r.words.length;
      let known = 0;
      r.words.forEach((w) => {
        if (w.reviews?.[0]?.status === REVIEW_STATUS.KNOWN) known++;
      });
      return {
        id: r.id,
        name: r.name,
        meaning: r.meaning,
        isDefault: r.isDefault,
        wordCount,
        known,
        learning: Math.max(wordCount - known, 0),
      };
    });

    success(res, result);
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
