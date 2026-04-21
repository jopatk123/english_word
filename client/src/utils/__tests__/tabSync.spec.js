import { isProxy, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabSyncChannel } from '../tabSync.js';

const openChannels = [];
const originalBroadcastChannel = globalThis.BroadcastChannel;

const createLocalStorageMock = () => {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(String(key));
    }),
    key: vi.fn((index) => Array.from(store.keys())[index] ?? null),
  };
};

describe('createTabSyncChannel', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    while (openChannels.length > 0) {
      openChannels.pop()?.close();
    }

    if (originalBroadcastChannel === undefined) {
      delete globalThis.BroadcastChannel;
    } else {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    }

    vi.unstubAllGlobals();
  });

  it('能接收来自其他标签页的 storage 同步事件', () => {
    const channel = createTabSyncChannel('spec');
    openChannels.push(channel);
    const handler = vi.fn();
    const unsubscribe = channel.subscribe(handler);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'english-word:spec:event',
        newValue: JSON.stringify({
          id: 'remote-message-1',
          senderId: 'remote-tab',
          sentAt: Date.now(),
          payload: { type: 'ping', value: 1 },
        }),
      })
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      { type: 'ping', value: 1 },
      expect.objectContaining({ via: 'storage' })
    );

    unsubscribe();
  });

  it('对同一消息 id 只处理一次，避免 BroadcastChannel 和 storage 双重投递', () => {
    const channel = createTabSyncChannel('dedupe');
    openChannels.push(channel);
    const handler = vi.fn();

    channel.subscribe(handler);

    const event = {
      id: 'duplicate-message',
      senderId: 'remote-tab',
      sentAt: Date.now(),
      payload: { type: 'sync' },
    };

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'english-word:dedupe:event',
        newValue: JSON.stringify(event),
      })
    );
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'english-word:dedupe:event',
        newValue: JSON.stringify(event),
      })
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('发布 Vue 响应式对象时会先序列化，避免 BroadcastChannel 抛错', () => {
    const postMessage = vi.fn((envelope) => {
      expect(isProxy(envelope.payload.data.stats)).toBe(false);
    });

    globalThis.BroadcastChannel = class MockBroadcastChannel {
      addEventListener() {}
      removeEventListener() {}
      close() {}
      postMessage(envelope) {
        if (isProxy(envelope.payload.data.stats)) {
          throw new DOMException('Proxy cannot be cloned', 'DataCloneError');
        }

        postMessage(envelope);
      }
    };

    const channel = createTabSyncChannel('proxy-safe');
    openChannels.push(channel);

    expect(() =>
      channel.publish({
        type: 'progress',
        data: {
          stats: ref({ total: 1, again: 0 }).value,
        },
      })
    ).not.toThrow();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].payload).toEqual({
      type: 'progress',
      data: {
        stats: { total: 1, again: 0 },
      },
    });
  });
});
