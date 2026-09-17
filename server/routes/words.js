import { Router } from 'express';
import queryRouter from './words/query.js';
import writeRouter from './words/write.js';
import imageRouter from './words/image.js';

const router = Router();

router.use('/', imageRouter);
router.use('/', queryRouter);
router.use('/', writeRouter);

export default router;
