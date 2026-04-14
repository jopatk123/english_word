import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabSyncChannel } from '../tabSync.js';

const openChannels = [];

describe('createTabSyncChannel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    while (openChannels.length > 0) {
      openChannels.pop()?.close();
    }
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
});
