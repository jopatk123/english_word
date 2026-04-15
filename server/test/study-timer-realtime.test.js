import http from 'http';
import request from 'supertest';
import WebSocket from 'ws';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { generateToken } from '../middleware/auth.js';
import { initDB, User } from '../models/index.js';
import { createStudyTimerHub } from '../realtime/study-timer-hub.js';

let resources = [];

const suf = () => Date.now() + Math.random().toString(36).slice(2, 5);

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const waitForMessage = (socket) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket message')), 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    const onMessage = (raw) => {
      cleanup();
      resolve(JSON.parse(raw.toString()));
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    socket.on('message', onMessage);
    socket.on('error', onError);
  });

beforeAll(async () => {
  await initDB();
});

afterEach(async () => {
  while (resources.length) {
    const resource = resources.pop();
    await resource();
  }
});

describe('学习计时 websocket', () => {
  it('连接时收到权威快照，start/stop 后收到最新广播', async () => {
    const user = await User.create({ username: `ws_${suf()}`, password: 'x' });
    const token = generateToken(user.id);
    const studyTimerHub = createStudyTimerHub();
    const app = createApp({ studyTimerHub });
    const server = http.createServer(app);
    studyTimerHub.attach(server);

    resources.push(async () => {
      await studyTimerHub.close();
      await closeServer(server);
    });

    const address = await listen(server);
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/study-timer?token=${token}`);
    resources.push(
      () =>
        new Promise((resolve) => {
          socket.once('close', () => resolve());
          socket.close();
        })
    );

    const initial = await waitForMessage(socket);
    expect(initial.type).toBe('study-timer/state');
    expect(initial.data.isRunning).toBe(false);

    const runningPromise = waitForMessage(socket);
    const startRes = await request(app)
      .post('/api/study-sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'ws' });

    const running = await runningPromise;
    expect(startRes.status).toBe(200);
    expect(running.data.isRunning).toBe(true);
    expect(running.data.sessionId).toBe(startRes.body.data.sessionId);

    const stoppedPromise = waitForMessage(socket);
    const stopRes = await request(app)
      .post(`/api/study-sessions/${startRes.body.data.sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);

    const stopped = await stoppedPromise;
    expect(stopRes.status).toBe(200);
    expect(stopped.data.isRunning).toBe(false);
  });
});