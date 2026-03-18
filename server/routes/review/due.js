import { Router } from 'express';
import { Op } from 'sequelize';
import { Word, Root, Example, WordReview } from '../../models/index.js';
import { success, error } from '../../utils/response.js';
import { todayStr, addDays } from '../../utils/srs.js';

const router = Router();

router.get('/due', async (req, res) => {
  try {
    const today = todayStr(req.query.tz);
    const limit = parseInt(req.query.limit) || 0;
    const offset = parseInt(req.query.offset) || 0;
    const advance = Math.min(parseInt(req.query.advance) || 0, 30);
    const dueDeadline = advance > 0 ? addDays(today, advance) : today;

    const queryOpts = {
      where: {
        userId: req.userId,
        dueDate: { [Op.lte]: dueDeadline },
        paused: false,
      },
      include: [{
        model: Word,
        as: 'word',
        include: [
          { model: Root, as: 'roots', through: { attributes: [] }, attributes: ['id', 'name', 'meaning'] },
          { model: Example, as: 'examples', attributes: ['id', 'sentence', 'translation'] },
        ],
      }],
      order: [['due_date', 'ASC'], ['ease_factor', 'ASC']],
    };

    if (limit > 0) {
      queryOpts.limit = limit;
      queryOpts.offset = offset;
    }

    const reviews = await WordReview.findAll(queryOpts);
    const valid = reviews.filter(r => r.word);
    success(res, valid);
  } catch (e) {
    error(res, e.message);
  }
});

export default router;
