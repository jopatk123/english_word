import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { User } from '../models/index.js';
import { getJwtSecret } from '../utils/env.js';
import { getStudyTimerState } from '../services/study-timer-state.js';

const HEARTBEAT_INTERVAL_MS = 30000;

function sendJson(socket, payload) {
  if (socket.readyState !== 1) return;
  socket.send(JSON.stringify(payload));
}

function getStudyTimerToken(request) {
  const header = request.headers['sec-websocket-protocol'];
  if (typeof header === 'string') {
    return header
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);
  }

  if (Array.isArray(header)) {
    return header
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .find(Boolean);
  }

  return '';
}

async function authenticateToken(token) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findByPk(decoded.userId);
    if (!user || user.isDisabled) return null;
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) return null;
    return user;
  } catch {
    return null;
  }
}

export function createStudyTimerHub() {
  const clientsByUserId = new Map();
  const wss = new WebSocketServer({ noServer: true });
  let heartbeatTimer = null;

  const removeClient = (userId, socket) => {
    const sockets = clientsByUserId.get(userId);
    if (!sockets) return;

    sockets.delete(socket);
    if (!sockets.size) {
      clientsByUserId.delete(userId);
    }
  };

  const addClient = (userId, socket) => {
    let sockets = clientsByUserId.get(userId);
    if (!sockets) {
      sockets = new Set();
      clientsByUserId.set(userId, sockets);
    }
    sockets.add(socket);
  };

  const publishTimerState = async (userId) => {
    const state = await getStudyTimerState(userId);
    const sockets = clientsByUserId.get(userId);

    if (sockets) {
      for (const socket of sockets) {
        sendJson(socket, { type: 'study-timer/state', data: state });
      }
    }

    return state;
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(() => {
      wss.clients.forEach((socket) => {
        if (socket.isAlive === false) {
          socket.terminate();
          return;
        }

        socket.isAlive = false;
        socket.ping();
      });
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = () => {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  wss.on('connection', (socket, _request, user) => {
    socket.isAlive = true;
    addClient(user.id, socket);

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('close', () => {
      removeClient(user.id, socket);
    });

    socket.on('error', () => {
      removeClient(user.id, socket);
    });

    void publishTimerState(user.id);
  });

  const attach = (server) => {
    server.on('upgrade', async (request, socket, head) => {
      const host = request.headers.host || 'localhost';
      const url = new URL(request.url, `http://${host}`);

      if (url.pathname !== '/ws/study-timer') {
        socket.destroy();
        return;
      }

      const token = getStudyTimerToken(request);
      const user = await authenticateToken(token);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, user);
      });
    });

    startHeartbeat();
  };

  const close = async () => {
    stopHeartbeat();

    for (const socket of wss.clients) {
      socket.terminate();
    }

    await new Promise((resolve) => {
      wss.close(() => resolve());
    });
  };

  return {
    attach,
    close,
    publishTimerState,
  };
}
