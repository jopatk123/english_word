import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoRead } from '../useAutoRead.js';

const mockSpeak = vi.fn();
const mockSpeakSequence = vi.fn().mockResolvedValue(true);
const mockCancelSpeech = vi.fn();
const mockPauseSpeech = vi.fn(() => {
  mockIsPaused.value = true;
});
const mockResumeSpeech = vi.fn(() => {
  mockIsPaused.value = false;
});
const mockIsPaused = ref(false);

vi.mock('../../utils/speech.js', () => ({
  useSpeech: () => ({
    speak: mockSpeak,
    speakSequence: mockSpeakSequence,
    cancelSpeech: mockCancelSpeech,
    pauseSpeech: mockPauseSpeech,
    resumeSpeech: mockResumeSpeech,
    isPaused: mockIsPaused,
  }),
}));

describe('useAutoRead wake lock', () => {
  let wakeLockRequestMock;
  let wakeLockReleaseMock;

  const installWakeLockMock = () => {
    wakeLockReleaseMock = vi.fn().mockResolvedValue(undefined);
    wakeLockRequestMock = vi.fn().mockResolvedValue({
      release: wakeLockReleaseMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: wakeLockRequestMock,
      },
    });
  };

  const createWrapper = () => {
    const currentCard = ref({
      word: {
        name: 'alpha',
        examples: [{ sentence: 'Alpha example.' }],
      },
    });
    const studyMode = ref('autoRead');
    const modeSelected = ref(true);
    const sessionStats = ref({ total: 0 });
    const advanceCard = vi.fn();

    const wrapper = mount({
      template: '<div />',
      setup() {
        return useAutoRead({
          currentCard,
          studyMode,
          modeSelected,
          sessionStats,
          advanceCard,
        });
      },
    });

    return {
      wrapper,
      currentCard,
      studyMode,
      modeSelected,
      sessionStats,
      advanceCard,
    };
  };

  beforeEach(() => {
    mockSpeak.mockReset();
    mockSpeakSequence.mockReset().mockResolvedValue(true);
    mockCancelSpeech.mockReset();
    mockPauseSpeech.mockReset();
    mockPauseSpeech.mockImplementation(() => {
      mockIsPaused.value = true;
    });
    mockResumeSpeech.mockReset();
    mockResumeSpeech.mockImplementation(() => {
      mockIsPaused.value = false;
    });
    mockIsPaused.value = false;
    installWakeLockMock();
  });

  afterEach(() => {
    delete navigator.wakeLock;
  });

  it('进入自动朗读后会申请屏幕唤醒锁', async () => {
    const { wrapper } = createWrapper();

    await nextTick();
    await Promise.resolve();

    expect(wakeLockRequestMock).toHaveBeenCalledTimes(1);
    expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');

    wrapper.unmount();
  });

  it('暂停时释放唤醒锁，恢复后重新申请', async () => {
    const { wrapper } = createWrapper();

    await nextTick();
    await Promise.resolve();

    wrapper.vm.toggleAutoReadPause();
    await nextTick();
    await Promise.resolve();

    expect(mockPauseSpeech).toHaveBeenCalledTimes(1);
    expect(wakeLockReleaseMock).toHaveBeenCalledTimes(1);

    wrapper.vm.toggleAutoReadPause();
    await nextTick();
    await Promise.resolve();

    expect(mockResumeSpeech).toHaveBeenCalledTimes(1);
    expect(wakeLockRequestMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('卸载时会释放唤醒锁', async () => {
    const { wrapper } = createWrapper();

    await nextTick();
    await Promise.resolve();

    wrapper.unmount();

    expect(wakeLockReleaseMock).toHaveBeenCalledTimes(1);
  });
});