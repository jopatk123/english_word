/**
 * 测试：client/src/utils/speech.js
 *   - pickEnglishVoice() 选音策略（通过 useSpeech 间接验证）
 *   - useSpeech().speak() 核心行为
 *   - useSpeech().speakSequence() 顺序朗读
 *   - 重复调用同一文本时执行 cancel（切换朗读）
 *
 * 注意：speakingText 是模块级 ref 单例，每个测试须用不同文本，
 * 或在 beforeEach 中 unstubAllGlobals + clearAllMocks。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSpeech } from '../speech.js';

const makeVoice = (name, lang) => ({ name, lang });

const setupSpeechMock = (voices = []) => {
  const speakMock = vi.fn();
  const cancelMock = vi.fn();
  const getVoicesMock = vi.fn().mockReturnValue(voices);

  vi.stubGlobal('speechSynthesis', {
    speak: speakMock,
    cancel: cancelMock,
    getVoices: getVoicesMock,
    addEventListener: vi.fn((_event, cb) => cb()), // 立即触发 voiceschanged
  });

  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.voice = null;
        this.onend = null;
        this.onerror = null;
      }
    }
  );

  return { speakMock, cancelMock, getVoicesMock };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals(); // 清理跨测试的 global stub，避免 speechSynthesis 残留
});

// ─── useSpeech().speak() ──────────────────────────────────────
describe('useSpeech().speak()', () => {
  it('调用时 speechSynthesis.speak 被执行', () => {
    const { speakMock } = setupSpeechMock([makeVoice('Samantha', 'en-US')]);
    const { speak } = useSpeech();
    speak('speak-basic-test');
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.text).toBe('speak-basic-test');
  });

  it('speechSynthesis 不存在时不报错（直接返回）', () => {
    // 不 stub speechSynthesis → jsdom 下默认不存在
    const { speak } = useSpeech();
    expect(() => speak('no-synth-test')).not.toThrow();
  });

  it('voices 列表为空时通过 voiceschanged 事件异步加载后朗读', () => {
    const { speakMock } = setupSpeechMock([makeVoice('Samantha', 'en-US')]);
    // getVoices 第一次返回空，模拟需要等待
    const { speechSynthesis } = globalThis;
    speechSynthesis.getVoices
      .mockReturnValueOnce([]) // 第一次为空
      .mockReturnValue([makeVoice('Samantha', 'en-US')]); // 之后有值

    const { speak } = useSpeech();
    speak('voices-wait-test');
    expect(speakMock).toHaveBeenCalled();
  });

  it('再次 speak 同一文本时调用 cancel（切换朗读逻辑）', () => {
    const { speakMock, cancelMock } = setupSpeechMock([makeVoice('en-US', 'en-US')]);
    const { speak, speakingText } = useSpeech();
    // 第一次：正常朗读
    speak('toggle-test');
    expect(speakMock).toHaveBeenCalledTimes(1);
    // 模拟 speakingText 的当前状态为朗读中
    speakingText.value = 'toggle-test';
    // 第二次：相同文本触发取消
    speak('toggle-test');
    expect(cancelMock).toHaveBeenCalled();
  });

  it('speakSequence 会按顺序朗读重复文本和句子', async () => {
    const { speakMock } = setupSpeechMock([makeVoice('Samantha', 'en-US')]);
    speakMock.mockImplementation((utterance) => utterance.onend?.());

    const { speakSequence } = useSpeech();

    await speakSequence(['sequence-word', 'sequence-word', 'sequence-sentence']);

    expect(speakMock).toHaveBeenCalledTimes(3);
    expect(speakMock.mock.calls.map(([utterance]) => utterance.text)).toEqual([
      'sequence-word',
      'sequence-word',
      'sequence-sentence',
    ]);
  });
});

// ─── 语音选择策略 ─────────────────────────────────────────────
describe('语音选择策略', () => {
  it('优先选择 macOS 高质量语音（Samantha）', () => {
    const voices = [
      makeVoice('Other', 'en-US'),
      makeVoice('Samantha', 'en-US'),
      makeVoice('Alex', 'en-US'),
    ];
    const { speakMock } = setupSpeechMock(voices);
    const { speak } = useSpeech();
    speak('voice-samantha-test');
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.voice.name).toBe('Samantha');
  });

  it('无优先语音时选择 en-US 语音', () => {
    const voices = [makeVoice('RandomUS', 'en-US'), makeVoice('随机', 'zh-CN')];
    const { speakMock } = setupSpeechMock(voices);
    const { speak } = useSpeech();
    speak('voice-enus-test');
    expect(speakMock).toHaveBeenCalled();
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.voice?.lang).toBe('en-US');
  });

  it('无 en-US 时兜底选择任意英语语音', () => {
    const voices = [makeVoice('BritVoice', 'en-GB'), makeVoice('中文', 'zh-TW')];
    const { speakMock } = setupSpeechMock(voices);
    const { speak } = useSpeech();
    speak('voice-engb-test');
    expect(speakMock).toHaveBeenCalled();
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.voice?.lang.startsWith('en')).toBe(true);
  });
});
