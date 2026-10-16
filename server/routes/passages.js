import { Router } from 'express';
import queryRouter from './passages/query.js';
import writeRouter from './passages/write.js';
import progressRouter from './passages/progress.js';

const router = Router();

router.use('/', queryRouter);
router.use('/', writeRouter);
router.use('/', progressRouter);

export default router;
