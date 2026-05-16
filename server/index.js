import http from 'http';
import { pathToFileURL } from 'url';
import { initDB } from './models/index.js';
import { createApp } from './app.js';
import { createStudyTimerHub } from './realtime/study-timer-hub.js';
import { getServerPort } from './utils/env.js';

export async function startServer(options = {}) {
  const {
    port = getServerPort(),
    initDBFn = initDB,
    createStudyTimerHubFn = createStudyTimerHub,
    createAppFn = createApp,
    createServerFn = http.createServer,
    log = console.log,
  } = options;

  await initDBFn();
  const studyTimerHub = createStudyTimerHubFn();
  const app = createAppFn({ studyTimerHub });
  const server = createServerFn(app);

  studyTimerHub.attach(server);

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  log(`服务已启动: http://localhost:${port}`);

  return { app, server, studyTimerHub, port };
}

const entryHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entryHref) {
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
