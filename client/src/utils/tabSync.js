const CHANNEL_PREFIX = 'english-word';

const createTabId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const TAB_ID = createTabId();

const trimSeenIds = (seenIds) => {
  if (seenIds.size <= 100) return;

  const oldestId = seenIds.values().next().value;
  if (oldestId) {
    seenIds.delete(oldestId);
  }
};

export const createTabSyncChannel = (channelName) => {
  const fullChannelName = `${CHANNEL_PREFIX}:${channelName}`;
  const storageKey = `${fullChannelName}:event`;
  const subscribers = new Set();
  const seenIds = new Set();

  const channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(fullChannelName) : null;

  const emitEnvelope = (envelope, via) => {
    if (!envelope?.id || envelope.senderId === TAB_ID || seenIds.has(envelope.id)) {
      return;
    }

    seenIds.add(envelope.id);
    trimSeenIds(seenIds);

    subscribers.forEach((handler) => {
      handler(envelope.payload, {
        via,
        sentAt: envelope.sentAt,
      });
    });
  };

  const handleStorage = (event) => {
    if (event.key !== storageKey || !event.newValue) return;

    try {
      emitEnvelope(JSON.parse(event.newValue), 'storage');
    } catch {
      // ignore invalid sync payloads
    }
  };

  const handleBroadcastMessage = (event) => {
    emitEnvelope(event?.data, 'broadcast-channel');
  };

  if (channel) {
    channel.addEventListener('message', handleBroadcastMessage);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  const publish = (payload) => {
    const envelope = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      senderId: TAB_ID,
      sentAt: Date.now(),
      payload,
    };

    if (channel) {
      channel.postMessage(envelope);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } catch {
        // ignore localStorage write failures
      }
    }
  };

  const subscribe = (handler) => {
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  };

  const close = () => {
    subscribers.clear();

    if (channel) {
      channel.removeEventListener('message', handleBroadcastMessage);
      channel.close();
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };

  return {
    publish,
    subscribe,
    close,
  };
};
