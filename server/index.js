import http from 'http';
import { initDB } from './models/index.js';
import { createApp } from './app.js';
import { createStudyTimerHub } from './realtime/study-timer-hub.js';

const PORT = process.env.PORT || 3010;

// 启动服务
const start = async () => {
  await initDB();
  const studyTimerHub = createStudyTimerHub();
  const app = createApp({ studyTimerHub });
  const server = http.createServer(app);

  studyTimerHub.attach(server);

  server.listen(PORT, () => {
    console.log(`服务已启动: http://localhost:${PORT}`);
  });
};

start();
