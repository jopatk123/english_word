import { mount } from '@vue/test-utils';
import SpeakButton from '../SpeakButton.vue';

describe('SpeakButton', () => {
  it('calls speechSynthesis.speak when clicked', async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    const getVoicesMock = vi.fn().mockReturnValue([{ lang: 'en-US' }]);

    window.speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: getVoicesMock,
      addEventListener: vi.fn(),
    };

    global.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.onend = null;
        this.onerror = null;
      }
    };

    const wrapper = mount(SpeakButton, {
      props: { text: 'hello' },
    });

    await wrapper.trigger('click');

    expect(speakMock).toHaveBeenCalled();
    expect(speakMock.mock.calls[0][0]).toBeInstanceOf(global.SpeechSynthesisUtterance);
    expect(speakMock.mock.calls[0][0].text).toBe('hello');
  });
});
