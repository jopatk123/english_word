import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const speakAsync = vi.fn();
const cancelSpeech = vi.fn();

vi.mock('../../utils/speech.js', () => ({
  DEFAULT_SPEECH_RATE: 0.85,
  useSpeech: () => ({ speakAsync, cancelSpeech }),
}));

const { usePassagePlayback } = await import('../usePassagePlayback.js');

const sentences = ref([
  { id: 1, text: 'One.' },
  { id: 2, text: 'Two.' },
]);

describe('usePassagePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    speakAsync.mockReset();
    cancelSpeech.mockReset();
    localStorage.clear();
    speakAsync.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('按顺序朗读，暂停后从当前句重读', async () => {
    let finish;
    speakAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const playback = usePassagePlayback(sentences);
    playback.play(0);
    expect(playback.currentIndex.value).toBe(0);
    expect(speakAsync).toHaveBeenCalledWith('One.', 'en-US', { rate: 0.85 });

    finish(true);
    await vi.advanceTimersByTimeAsync(350);
    expect(playback.currentIndex.value).toBe(1);

    playback.pause();
    expect(cancelSpeech).toHaveBeenCalled();
    expect(playback.playing.value).toBe(false);
    expect(playback.currentIndex.value).toBe(1);

    playback.play();
    expect(speakAsync).toHaveBeenLastCalledWith('Two.', 'en-US', { rate: 0.85 });
    playback.stop();
  });

  it('单句循环不前进，语速在下一句生效', async () => {
    speakAsync.mockResolvedValue(true);
    const playback = usePassagePlayback(sentences);
    playback.toggleLoop();
    playback.setRate(1.2);
    playback.play(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(speakAsync.mock.calls.length).toBeGreaterThan(1);
    expect(speakAsync.mock.calls.every((call) => call[0] === 'One.' && call[2].rate === 1.2)).toBe(
      true
    );
    playback.stop();
  });

  it('读完最后一句后停止并通知', async () => {
    speakAsync.mockResolvedValue(true);
    const onFinished = vi.fn();
    const playback = usePassagePlayback(sentences, { onFinished });
    playback.play(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(playback.playing.value).toBe(false);
    expect(playback.currentIndex.value).toBe(-1);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
