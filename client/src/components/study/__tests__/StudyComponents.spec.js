/**
 * 测试：study 学习模式组件
 *   - ModeSelect.vue
 *   - SessionComplete.vue
 *   - SessionProgress.vue
 *   - FlashcardMode.vue
 *   - ChoiceMode.vue
 *   - SpellingMode.vue
 */
import { mount } from '@vue/test-utils';
import ModeSelect from '../ModeSelect.vue';
import SessionComplete from '../SessionComplete.vue';
import SessionProgress from '../SessionProgress.vue';
import FlashcardMode from '../FlashcardMode.vue';
import ChoiceMode from '../ChoiceMode.vue';
import SpellingMode from '../SpellingMode.vue';

// ── 公用 stubs ─────────────────────────────────────────────────
const globalStubs = {
  SpeakButton: { template: '<button class="speak-stub" />' },
  SessionProgress: { template: '<div class="progress-stub" />' },
  'el-button': {
    props: ['loading'],
    emits: ['click'],
    template: '<button class="el-btn" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-input': {
    props: ['modelValue', 'size', 'placeholder', 'type', 'showPassword'],
    emits: ['update:modelValue'],
    methods: {
      focus() {},
    },
    template:
      '<div class="el-input-stub"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
  },
  'el-alert': { template: '<div class="el-alert-stub"><slot /><slot name="default" /></div>' },
  'el-progress': true,
};

// ── ModeSelect ─────────────────────────────────────────────────

describe('ModeSelect', () => {
  const modeNames = { flashcard: '闪卡', choice: '选择题', spelling: '拼写', listening: '听力' };

  const createWrapper = (props = {}) =>
    mount(ModeSelect, {
      props: { queueLength: 10, modeNames, resumeInfo: null, ...props },
      global: { stubs: globalStubs },
    });

  it('显示待复习单词数量', () => {
    const wrapper = createWrapper({ queueLength: 5 });
    expect(wrapper.text()).toContain('5');
    expect(wrapper.text()).toContain('待复习');
  });

  it('resumeInfo 为 null 时不显示断点续学', () => {
    const wrapper = createWrapper({ resumeInfo: null });
    expect(wrapper.find('.resume-banner').exists()).toBe(false);
  });

  it('resumeInfo 存在时显示断点续学', () => {
    const wrapper = createWrapper({ resumeInfo: { index: 2, mode: 'flashcard' } });
    expect(wrapper.find('.resume-banner').exists()).toBe(true);
    expect(wrapper.text()).toContain('3');
  });

  it('点击闪卡模式触发 select flashcard', async () => {
    const wrapper = createWrapper();
    const cards = wrapper.findAll('.mode-card');
    await cards[0].trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')[0]).toEqual(['flashcard']);
  });

  it('点击选择题触发 select choice', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[1].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['choice']);
  });

  it('点击拼写模式触发 select spelling', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[2].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['spelling']);
  });

  it('点击听力模式触发 select listening', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.mode-card')[3].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['listening']);
  });

  it('显示所有四种学习模式', () => {
    const wrapper = createWrapper();
    const cards = wrapper.findAll('.mode-card');
    expect(cards).toHaveLength(4);
  });

  it('断点续学显示 resume 和 dismiss 按钮', async () => {
    const wrapper = createWrapper({ resumeInfo: { index: 1, mode: 'spelling' } });
    const buttons = wrapper.findAll('.el-btn');
    const resumeBtn = buttons.find((b) => b.text().includes('继续'));
    const dismissBtn = buttons.find((b) => b.text().includes('重新'));
    await resumeBtn?.trigger('click');
    expect(wrapper.emitted('resume')).toBeTruthy();
    await dismissBtn?.trigger('click');
    expect(wrapper.emitted('dismiss')).toBeTruthy();
  });
});

// ── SessionComplete ─────────────────────────────────────────────

describe('SessionComplete', () => {
  const defaultStats = { total: 10, again: 2, hard: 3, good: 4, easy: 1 };

  const createWrapper = (props = {}) =>
    mount(SessionComplete, {
      props: {
        sessionStats: defaultStats,
        hasAgainWords: false,
        againWordCount: 0,
        totalWords: 10,
        ...props,
      },
      global: {
        stubs: globalStubs,
        mocks: { $router: { push: vi.fn() } },
      },
    });

  it('显示复习总数', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('10');
    expect(wrapper.text()).toContain('本次复习');
  });

  it('again 数量 > 0 时显示', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('再来一遍');
    expect(wrapper.text()).toContain('2');
  });

  it('again 数量为 0 时不显示', () => {
    const wrapper = createWrapper({ sessionStats: { ...defaultStats, again: 0 } });
    expect(wrapper.find('.result-again').exists()).toBe(false);
  });

  it('hasAgainWords=true 时显示只练错误单词按钮', () => {
    const wrapper = createWrapper({ hasAgainWords: true, againWordCount: 3 });
    expect(wrapper.text()).toContain('只练错误单词');
    expect(wrapper.text()).toContain('3');
  });

  it('hasAgainWords=false 时不显示只练错误单词按钮', () => {
    const wrapper = createWrapper({ hasAgainWords: false });
    expect(wrapper.text()).not.toContain('只练错误单词');
  });

  it('点击换模式触发 replay 事件', async () => {
    const wrapper = createWrapper();
    const buttons = wrapper.findAll('.el-btn');
    const replayBtn = buttons.find((b) => b.text().includes('换模式'));
    await replayBtn?.trigger('click');
    expect(wrapper.emitted('replay')).toBeTruthy();
  });

  it('hard/good/easy 统计正确渲染', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('有点难');
    expect(wrapper.text()).toContain('认识');
    expect(wrapper.text()).toContain('很熟悉');
  });

  // ── 继续复习按钮 ─────────────────────────────────────────────

  it('有 again 词时"继续复习"按钮显示难词数量', () => {
    const wrapper = createWrapper({ hasAgainWords: true, againWordCount: 4, totalWords: 10 });
    expect(wrapper.text()).toContain('继续复习');
    expect(wrapper.text()).toContain('先练 4 个难词');
  });

  it('无 again 词时"继续复习"按钮显示总词数', () => {
    const wrapper = createWrapper({ hasAgainWords: false, againWordCount: 0, totalWords: 8 });
    expect(wrapper.text()).toContain('继续复习');
    expect(wrapper.text()).toContain('共 8 个');
  });

  it('点击"继续复习"触发 continue-review 事件', async () => {
    const wrapper = createWrapper({ totalWords: 10 });
    const buttons = wrapper.findAll('.el-btn');
    const continueBtn = buttons.find((b) => b.text().includes('继续复习'));
    await continueBtn?.trigger('click');
    expect(wrapper.emitted('continue-review')).toBeTruthy();
  });
});

// ── SessionProgress ─────────────────────────────────────────────

describe('SessionProgress', () => {
  const createWrapper = (props = {}) =>
    mount(SessionProgress, {
      props: { currentIndex: 0, total: 10, ...props },
      global: { stubs: { 'el-progress': true } },
    });

  it('显示进度文字 1/10', () => {
    const wrapper = createWrapper({ currentIndex: 0, total: 10 });
    expect(wrapper.text()).toContain('1 / 10');
  });

  it('currentIndex=4 时显示 5/10', () => {
    const wrapper = createWrapper({ currentIndex: 4, total: 10 });
    expect(wrapper.text()).toContain('5 / 10');
  });
});

// ── FlashcardMode ───────────────────────────────────────────────

describe('FlashcardMode', () => {
  const defaultCard = {
    wordId: 1,
    word: {
      id: 1,
      name: 'inspect',
      phonetic: '/ɪnˈspekt/',
      meaning: '检查；视察',
      roots: [{ name: 'spect', meaning: '看' }],
      examples: [{ id: 1, sentence: 'She inspects the room.', translation: '她检查房间。' }],
    },
  };

  const createWrapper = (props = {}) =>
    mount(FlashcardMode, {
      props: {
        card: defaultCard,
        showAnswer: false,
        currentIndex: 0,
        total: 5,
        submitting: false,
        againCountMap: {},
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示单词名称', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('inspect');
  });

  it('显示音标', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('/ɪnˈspekt/');
  });

  it('显示词根信息', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('spect');
  });

  it('showAnswer=false 时显示"显示答案"按钮', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('显示答案');
  });

  it('点击"显示答案"触发 flip 事件', async () => {
    const wrapper = createWrapper();
    const btn = wrapper.find('.el-btn');
    await btn.trigger('click');
    expect(wrapper.emitted('flip')).toBeTruthy();
  });

  it('showAnswer=true 时显示评分按钮', () => {
    const wrapper = createWrapper({ showAnswer: true });
    expect(wrapper.text()).toContain('再来一遍');
    expect(wrapper.text()).toContain('认识');
  });

  it('showAnswer=true 时显示单词释义', () => {
    const wrapper = createWrapper({ showAnswer: true });
    expect(wrapper.text()).toContain('检查；视察');
  });

  it('点击评分按钮触发 rate 事件', async () => {
    const wrapper = createWrapper({ showAnswer: true });
    const rateBtn = wrapper.findAll('.el-btn').find((b) => b.text().includes('认识'));
    await rateBtn?.trigger('click');
    expect(wrapper.emitted('rate')).toBeTruthy();
    expect(wrapper.emitted('rate')[0]).toEqual([3]);
  });

  it('againCountMap 有值时显示复习次数', () => {
    const wrapper = createWrapper({ againCountMap: { 1: 1 } });
    expect(wrapper.text()).toContain('第 2 次复习');
  });
});

// ── SpellingMode ────────────────────────────────────────────────

describe('SpellingMode', () => {
  const defaultCard = {
    wordId: 3,
    word: {
      name: 'construct',
      phonetic: '/kənˈstrʌkt/',
      meaning: '建造；构建',
      roots: [{ name: 'struct', meaning: '建造' }],
    },
  };

  const createWrapper = (props = {}) =>
    mount(SpellingMode, {
      props: {
        card: defaultCard,
        currentIndex: 0,
        total: 5,
        mode: 'spelling',
        inputValue: '',
        answered: false,
        correct: false,
        hard: false,
        submitting: false,
        spellingHint: '输入单词拼写...',
        isLast: false,
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('spelling 模式显示单词释义', () => {
    const wrapper = createWrapper({ mode: 'spelling' });
    expect(wrapper.text()).toContain('建造；构建');
  });

  it('spelling 模式显示词根信息', () => {
    const wrapper = createWrapper({ mode: 'spelling' });
    expect(wrapper.text()).toContain('struct');
  });

  it('listening 模式显示提示文字', () => {
    const wrapper = createWrapper({ mode: 'listening' });
    expect(wrapper.text()).toContain('听发音，拼写单词');
  });

  it('unanswered 时显示确认按钮', () => {
    const wrapper = createWrapper({ answered: false });
    expect(wrapper.text()).toContain('确认');
  });

  it('answered + correct=true 显示正确提示', () => {
    const wrapper = createWrapper({ answered: true, correct: true, inputValue: 'construct' });
    expect(wrapper.text()).toContain('正确');
  });

  it('answered + correct=false 显示错误提示和正确答案', () => {
    const wrapper = createWrapper({ answered: true, correct: false, inputValue: 'constrct' });
    expect(wrapper.text()).toContain('正确答案');
    expect(wrapper.text()).toContain('construct');
  });

  it('answered + hard=true 显示接近正确提示', () => {
    const wrapper = createWrapper({
      answered: true,
      correct: false,
      hard: true,
      inputValue: 'constract',
    });
    expect(wrapper.text()).toContain('接近正确');
    expect(wrapper.text()).toContain('construct');
  });

  it('answered + hard=false + correct=false 显示完全错误提示', () => {
    const wrapper = createWrapper({ answered: true, correct: false, hard: false, inputValue: 'xyz' });
    expect(wrapper.text()).toContain('正确答案');
    expect(wrapper.text()).not.toContain('接近正确');
  });

  it('answered 时显示下一个按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: false });
    expect(wrapper.text()).toContain('下一个');
  });

  it('isLast=true 时显示完成按钮', () => {
    const wrapper = createWrapper({ answered: true, correct: true, isLast: true });
    expect(wrapper.text()).toContain('完成');
  });

  it('listening 模式 answered + wrong 显示释义', () => {
    const wrapper = createWrapper({
      mode: 'listening',
      answered: true,
      correct: false,
      inputValue: 'wrong',
    });
    expect(wrapper.text()).toContain('建造；构建');
  });

  it('spelling 模式时不显示 listening 提示', () => {
    const wrapper = createWrapper({ mode: 'spelling' });
    expect(wrapper.text()).not.toContain('听发音，拼写单词');
  });
});

// ── ChoiceMode ──────────────────────────────────────────────────

describe('ChoiceMode', () => {
  const defaultCard = {
    wordId: 2,
    word: { id: 2, name: 'transport', phonetic: '/trænsˈpɔːrt/', meaning: '运输' },
  };

  const options = [
    { id: 2, meaning: '运输' },
    { id: 3, meaning: '检查' },
    { id: 4, meaning: '分析' },
    { id: 5, meaning: '创造' },
  ];

  const createWrapper = (props = {}) =>
    mount(ChoiceMode, {
      props: {
        card: defaultCard,
        choiceOptions: options,
        choiceSelected: -1,
        choiceAnswered: false,
        submitting: false,
        currentIndex: 0,
        total: 5,
        isLast: false,
        ...props,
      },
      global: { stubs: globalStubs },
    });

  it('显示单词名称', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('transport');
  });

  it('显示 4 个选项', () => {
    const wrapper = createWrapper();
    expect(wrapper.findAll('.choice-option')).toHaveLength(4);
  });

  it('点击选项触发 choose 事件', async () => {
    const wrapper = createWrapper();
    await wrapper.findAll('.choice-option')[0].trigger('click');
    expect(wrapper.emitted('choose')).toBeTruthy();
    expect(wrapper.emitted('choose')[0]).toEqual([0]);
  });

  it('choiceAnswered=true 时已答题不再触发选择', async () => {
    const wrapper = createWrapper({ choiceAnswered: true });
    await wrapper.findAll('.choice-option')[0].trigger('click');
    expect(wrapper.emitted('choose')).toBeFalsy();
  });

  it('非末尾题时按钮显示"下一个"', () => {
    const wrapper = createWrapper({ choiceAnswered: true, isLast: false });
    expect(wrapper.text()).toContain('下一个');
  });

  it('isLast=true 时按钮显示"完成"', () => {
    const wrapper = createWrapper({ choiceAnswered: true, isLast: true });
    expect(wrapper.text()).toContain('完成');
  });
});
