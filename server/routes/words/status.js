import { Router } from 'express';
import { Word, WordReview } from '../../models/index.js';
import { success, error, handleRouteError } from '../../utils/response.js';
import { normalizeLookupWord } from '../../services/word-lookup.js';

const router = Router();

const MAX_STATUS_LOOKUP_WORDS = 500;

// 批量查询一组词在个人词库里的学习状态，供短文阅读时高亮使用
router.post('/status-lookup', async (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words)) return error(res, 'words 必须为数组', 400);
    if (words.length > MAX_STATUS_LOOKUP_WORDS) {
      return error(res, `一次最多查询 ${MAX_STATUS_LOOKUP_WORDS} 个词`, 400);
    }

    const names = [...new Set(words.map(normalizeLookupWord).filter(Boolean))];
    if (!names.length) return success(res, { items: {} });

    const found = await Word.findAll({
      where: { userId: req.userId, name: names },
      attributes: ['id', 'name'],
      include: [
        {
          model: WordReview,
          as: 'reviews',
          where: { userId: req.userId },
          required: false,
          attributes: ['status'],
        },
      ],
    });

    const items = Object.fromEntries(
      found.map((word) => [
        word.name,
        { wordId: word.id, status: word.reviews?.[0]?.status || 'new' },
      ])
    );
    success(res, { items });
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
