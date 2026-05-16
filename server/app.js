import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './middleware/auth.js';
import { aiRateLimiter, authRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './utils/logger.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import aiSettingsRouter from './routes/ai-settings.js';
import rootsRouter from './routes/roots.js';
import wordsRouter from './routes/words.js';
import examplesRouter from './routes/examples.js';
import aiRouter from './routes/ai.js';
import reviewRouter from './routes/review.js';
import { createStudySessionsRouter } from './routes/study-sessions.js';
import { getAllowedOrigins } from './utils/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options = {}) {
  const app = express();
  const studyTimerHub = options.studyTimerHub;

  // 安全响应头（生产环境启用 CSP，静态资源与 SPA 需要放宽 script-src）
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'", 'data:'],
        },
      },
    })
  );

  // CORS：仅允许 ALLOWED_ORIGINS 中配置的来源；未配置则拒绝所有跨域请求
  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      origin: allowedOrigins.length
        ? (origin, callback) => {
            // 同源请求 origin 为 undefined，始终放行
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error(`CORS: 来源 ${origin} 不在白名单中`));
            }
          }
        : false,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  app.get('/api/health', (_req, res) => {
    res.json({ code: 200, data: { status: 'ok' }, msg: 'success' });
  });

  app.use('/api/auth', authRateLimiter, authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ai-settings', authMiddleware, aiSettingsRouter);

  app.use('/api/roots', authMiddleware, rootsRouter);
  app.use('/api/words', authMiddleware, wordsRouter);
  app.use('/api/examples', authMiddleware, examplesRouter);
  app.use('/api/ai', authMiddleware, aiRateLimiter, aiRouter);
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
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
