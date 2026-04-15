import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyTimer } from '../useStudyTimer.js';

const apiMocks = vi.hoisted(() => ({
  createStudyTimerSocket: vi.fn(),
  endStudySession: vi.fn(),
  getStudySessionStats: vi.fn(),
  getStudyTimerState: vi.fn(),
  startStudySession: vi.fn(),
}));

vi.mock('../../api/index.js', () => apiMocks);

class MockSocket {
  constructor() {
    this.readyState = 0;
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {});
  }

  emit(type, payload) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => handler(payload));
  }

  open() {
    this.readyState = 1;
    this.emit('open', {});
  }

  pushState(state) {
    this.emit('message', {
      data: JSON.stringify({ type: 'study-timer/state', data: state }),
    });
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

const makeState = (overrides = {}) => ({
  isRunning: false,
  sessionId: null,
  startedAt: null,
  elapsedSeconds: 0,
  serverNow: new Date('2026-04-15T10:00:00.000Z').toISOString(),
  stateChangedAtMs: Date.parse('2026-04-15T10:00:00.000Z'),
  revision: '100:0:0',
  ...overrides,
});

describe('useStudyTimer', () => {
  let socket;

  beforeEach(() => {
    vi.useFakeTimers();
    socket = new MockSocket();
    apiMocks.createStudyTimerSocket.mockReturnValue(socket);
    apiMocks.getStudySessionStats.mockResolvedValue({
      data: { totalSeconds: 0, todaySeconds: 0, recentSessions: [] },
    });
    apiMocks.getStudyTimerState.mockResolvedValue({
      data: makeState({
        isRunning: true,
        sessionId: 8,
        startedAt: '2026-04-15T09:59:30.000Z',
        elapsedSeconds: 30,
      }),
    });
    apiMocks.startStudySession.mockResolvedValue({ data: makeState() });
    apiMocks.endStudySession.mockResolvedValue({ data: makeState() });

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => {
        if (key === 'token') return 'jwt';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('Notification', {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function mountHarness() {
    return mount({
      template: '<div />',
      setup() {
        return useStudyTimer();
      },
    });
  }

  it('挂载后先拉取服务端权威状态并启动计时', async () => {
    const wrapper = mountHarness();
    await flush();
    socket.open();
    await flush();

    expect(apiMocks.getStudyTimerState).toHaveBeenCalled();
    expect(wrapper.vm.isRunning).toBe(true);
    expect(wrapper.vm.sessionId).toBe(8);
    expect(wrapper.vm.elapsedSeconds).toBe(30);

    vi.advanceTimersByTime(2000);
    await nextTick();

    expect(wrapper.vm.elapsedSeconds).toBeGreaterThanOrEqual(32);
    wrapper.unmount();
  });

  it('会忽略旧的 websocket 状态，避免被乱序消息回滚', async () => {
    const wrapper = mountHarness();
    await flush();
    socket.open();
    await flush();

    socket.pushState(
      makeState({
        isRunning: true,
        sessionId: 9,
        startedAt: '2026-04-15T10:00:10.000Z',
        elapsedSeconds: 5,
        stateChangedAtMs: Date.parse('2026-04-15T10:00:15.000Z'),
        revision: '200:9:1',
      })
    );
    await flush();

    socket.pushState(
      makeState({
        isRunning: false,
        sessionId: null,
        startedAt: null,
        elapsedSeconds: 0,
        stateChangedAtMs: Date.parse('2026-04-15T10:00:05.000Z'),
        revision: '150:0:0',
      })
    );
    await flush();

    expect(wrapper.vm.isRunning).toBe(true);
    expect(wrapper.vm.sessionId).toBe(9);
    wrapper.unmount();
  });

  it('start 和 stop 都以服务端返回状态为准，并暴露处理中状态', async () => {
    apiMocks.getStudyTimerState.mockResolvedValueOnce({ data: makeState() });
    apiMocks.startStudySession.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: makeState({
                isRunning: true,
                sessionId: 12,
                startedAt: '2026-04-15T10:01:00.000Z',
                elapsedSeconds: 0,
                stateChangedAtMs: Date.parse('2026-04-15T10:01:00.000Z'),
                revision: '300:12:1',
              }),
            });
          }, 20);
        })
    );
    apiMocks.endStudySession.mockResolvedValue({
      data: makeState({
        isRunning: false,
        sessionId: null,
        startedAt: null,
        elapsedSeconds: 0,
        stateChangedAtMs: Date.parse('2026-04-15T10:02:00.000Z'),
        revision: '400:12:0',
      }),
    });

    const wrapper = mountHarness();
    await flush();

    const startPromise = wrapper.vm.startTimer();
    expect(wrapper.vm.actionPending).toBe(true);

    vi.advanceTimersByTime(20);
    await startPromise;
    await flush();

    expect(wrapper.vm.actionPending).toBe(false);
    expect(wrapper.vm.isRunning).toBe(true);
    expect(wrapper.vm.sessionId).toBe(12);

    await wrapper.vm.stopTimer();
    await flush();

    expect(apiMocks.endStudySession).toHaveBeenCalledWith(12);
    expect(wrapper.vm.isRunning).toBe(false);
    wrapper.unmount();
  });
});