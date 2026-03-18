import { Router } from 'express';
import dueRouter from './review/due.js';
import statsRouter from './review/stats.js';
import sessionRouter from './review/session.js';
import manageRouter from './review/manage.js';
import historyRouter from './review/history.js';

const router = Router();

// 具名路由优先挂载，避免被 /:wordId 参数路由抢先匹配
router.use(dueRouter);
router.use(statsRouter);
router.use(historyRouter);
router.use(sessionRouter);
router.use(manageRouter);

export default router;
