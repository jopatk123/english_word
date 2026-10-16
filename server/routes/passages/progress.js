import { Router } from 'express';
import { PassageReview } from '../../models/index.js';
import { success, handleRouteError } from '../../utils/response.js';
import { todayStr } from '../../utils/srs.js';
import {
  PASSAGE_RATINGS,
  computeNextPassageReview,
  derivePassageStatus,
} from '../../services/passage-review.js';
import { PassageError, findOwnedPassage, serializeReview } from '../../services/passage-store.js';
import { addWordFromPassage } from '../../services/passage-words.js';

const router = Router();

router.post('/:id/read', async (req, res) => {
  try {
    const { rating } = req.body;
    if (!PASSAGE_RATINGS.includes(rating)) throw new PassageError('自评只能是 hard、good 或 easy');

    const passage = await findOwnedPassage(req.userId, req.params.id);
    const today = todayStr(req.body.tz);
    const existing = await PassageReview.findOne({
      where: { userId: req.userId, passageId: passage.id },
    });
    const next = computeNextPassageReview(existing, rating, today);
    const values = {
      stage: next.stage,
      dueDate: next.dueDate,
      lastRating: rating,
      lastReadAt: new Date(),
      readCount: (existing?.readCount || 0) + 1,
    };

    const review = existing
      ? await existing.update(values)
      : await PassageReview.create({ ...values, userId: req.userId, passageId: passage.id });

    success(res, {
      review: serializeReview(review),
      status: derivePassageStatus(review, today),
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.post('/:id/words', async (req, res) => {
  try {
    const result = await addWordFromPassage(req.userId, req.params.id, req.body);
    const msg = result.wordCreated
      ? '已加入词库，并保存了例句'
      : result.exampleAdded
        ? '已把这句加为例句'
        : '单词和例句都已存在';
    success(res, result, msg);
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
