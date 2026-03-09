import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './models/index.js';
import rootsRouter from './routes/roots.js';
import wordsRouter from './routes/words.js';
import examplesRouter from './routes/examples.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3010;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API路由
app.use('/api/roots', rootsRouter);
app.use('/api/words', wordsRouter);
app.use('/api/examples', examplesRouter);

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
