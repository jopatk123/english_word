import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, jwtAuthMiddleware } from './middleware/auth.js';
import { aiRateLimiter, authRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './utils/logger.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import aiSettingsRouter from './routes/ai-settings.js';
import apiTokensRouter from './routes/api-tokens.js';
import rootsRouter from './routes/roots.js';
import wordsRouter from './routes/words.js';
import examplesRouter from './routes/examples.js';
import aiRouter from './routes/ai.js';
import reviewRouter from './routes/review.js';
import { createStudySessionsRouter } from './routes/study-sessions.js';
import { getAllowedOrigins, getTrustProxySetting } from './utils/env.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options = {}) {
  const app = express();
  const studyTimerHub = options.studyTimerHub;

  // 反向代理支持：正确解析 req.ip（限流按真实客户端 IP 生效）。
  // 未显式配置时生产环境信任一层代理，其他环境不信任（详见 utils/env.js）。
  app.set('trust proxy', getTrustProxySetting());

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
          // 显式禁用 upgrade-insecure-requests：
          // 该指令会让浏览器把 HTTP 子资源请求升级为 HTTPS，
          // 在无 HTTPS 的直连部署（如 http://host:3010）下会导致 JS/CSS 加载失败、页面白屏。
          upgradeInsecureRequests: null,
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
              const corsError = new Error(`CORS: 来源 ${origin} 不在白名单中`);
              corsError.status = 403;
              corsError.expose = true; // 允许统一错误处理器回传该提示
              callback(corsError);
            }
          }
        : false,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  // Express 5 中请求未命中任何 body parser 时 req.body 为 undefined，
  // 统一兜底为空对象，避免路由解构 req.body 抛 TypeError 变成 500。
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use(requestLogger);

  app.get('/api/health', (_req, res) => {
    res.json({ code: 200, data: { status: 'ok' }, msg: 'success' });
  });

  app.use('/api/auth', authRateLimiter, authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/api-tokens', jwtAuthMiddleware, apiTokensRouter);
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

  // 统一错误处理：任何未捕获异常都返回 JSON，避免 Express 默认处理器
  // 返回 HTML 并在响应体中泄漏堆栈与服务器路径。
  // 4xx（如 CORS 拒绝、JSON 解析失败）回传可暴露的提示，5xx 只回传通用提示并服务端记日志。
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const status = Number.isInteger(err.status) && err.status >= 400 ? err.status : 500;

    if (status >= 500) {
      logger.error('unhandled-error', {
        method: req.method,
        url: req.originalUrl,
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json({ code: 500, data: null, msg: '服务器内部错误' });
      return;
    }

    // 4xx 仅回传显式标记可暴露的信息（如 CORS 拒绝、请求体解析失败），
    // 其余（如文件读取失败）统一返回通用提示，避免泄漏服务器路径。
    const msg = err.expose === true && err.message ? err.message : '请求失败';
    res.status(status).json({ code: status, data: null, msg });
  });

  return app;
}
