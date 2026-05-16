import { Router } from 'express';
import queryRouter from './words/query.js';
import writeRouter from './words/write.js';

const router = Router();

router.use('/', queryRouter);
router.use('/', writeRouter);

export default router;
