import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './models/index.js';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import rootsRouter from './routes/roots.js';
import wordsRouter from './routes/words.js';
import examplesRouter from './routes/examples.js';
import aiRouter from './routes/ai.js';
import reviewRouter from './routes/review.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3010;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 认证路由（无需登录）
app.use('/api/auth', authRouter);

// 需要登录的 API 路由
app.use('/api/roots', authMiddleware, rootsRouter);
app.use('/api/words', authMiddleware, wordsRouter);
app.use('/api/examples', authMiddleware, examplesRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api/review', authMiddleware, reviewRouter);

// 托管前端静态资源
const clientDist = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDist));

// 前端路由回退（处理Vue Router刷新404）
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// 启动服务
const start = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`服务已启动: http://localhost:${PORT}`);
  });
};

start();
