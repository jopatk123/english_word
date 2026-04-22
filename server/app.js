import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import rootsRouter from './routes/roots.js';
import wordsRouter from './routes/words.js';
import examplesRouter from './routes/examples.js';
import aiRouter from './routes/ai.js';
import reviewRouter from './routes/review.js';
import { createStudySessionsRouter } from './routes/study-sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options = {}) {
  const app = express();
  const studyTimerHub = options.studyTimerHub;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api/roots', authMiddleware, rootsRouter);
  app.use('/api/words', authMiddleware, wordsRouter);
  app.use('/api/examples', authMiddleware, examplesRouter);
  app.use('/api/ai', authMiddleware, aiRouter);
  app.use('/api/review', authMiddleware, reviewRouter);
  app.use(
    '/api/study-sessions',
    authMiddleware,
    createStudySessionsRouter({
      publishTimerState: studyTimerHub?.publishTimerState,
    })
  );

  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist));

  // 对 /api/* 的未匹配请求返回 JSON 404，而非 HTML，
  // 避免 API 客户端拿到 SPA 页面而误判请求成功。
  app.use('/api', (req, res) => {
    res.status(404).json({
      code: 404,
      data: null,
      msg: `API 路由不存在: ${req.method} ${req.originalUrl}`,
    });
  });

  // SPA fallback：仅对非 API 路由回退到前端入口
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}