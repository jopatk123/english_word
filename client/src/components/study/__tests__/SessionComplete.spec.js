import { mount } from '@vue/test-utils';
import SessionComplete from '../SessionComplete.vue';
import { globalStubs } from './studyTestUtils';

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