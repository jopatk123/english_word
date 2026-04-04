import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudyDashboardView from '../StudyDashboardView.vue';

const pushMock = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const getReviewStatsMock = vi.fn();
const getRootsProgressMock = vi.fn();
const getReviewHistorySummaryMock = vi.fn();
const enqueueRootMock = vi.fn();
const exportAllDataMock = vi.fn();
const importAllDataMock = vi.fn();

vi.mock('../../api/index.js', () => ({
  getReviewStats: (...args) => getReviewStatsMock(...args),
  getRootsProgress: (...args) => getRootsProgressMock(...args),
  getReviewHistorySummary: (...args) => getReviewHistorySummaryMock(...args),
  enqueueRoot: (...args) => enqueueRootMock(...args),
  exportAllData: (...args) => exportAllDataMock(...args),
  importAllData: (...args) => importAllDataMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const globalStubs = {
  'el-breadcrumb': { template: '<div><slot /></div>' },
  'el-breadcrumb-item': { template: '<div><slot /></div>' },
  'el-button': {
    props: ['disabled', 'loading', 'size', 'type', 'plain'],
    emits: ['click'],
    template:
      '<button class="el-btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-table': { template: '<div class="el-table-stub" />' },
  'el-table-column': { template: '<div class="el-table-column-stub" />' },
  'el-progress': true,
  'el-link': { template: '<a><slot /></a>' },
  'el-tag': { template: '<span><slot /></span>' },
};

async function createWrapper(statsOverrides = {}) {
  getReviewStatsMock.mockResolvedValue({
    data: {
      total: 8,
      due: 0,
      todayDue: 0,
      new: 0,
      learning: 5,
      known: 3,
      todayReviewed: 2,
      overdue: 1,
      weekDue: 0,
      ...statsOverrides,
    },
  });
  getReviewHistorySummaryMock.mockResolvedValue({ data: { streak: 1, totalReviews: 9 } });
  getRootsProgressMock.mockResolvedValue({ data: [] });
  enqueueRootMock.mockResolvedValue({ msg: 'ok' });
  exportAllDataMock.mockResolvedValue({});
  importAllDataMock.mockResolvedValue({ msg: 'ok' });

  const wrapper = mount(StudyDashboardView, {
    global: {
      stubs: globalStubs,
      directives: {
        loading: {
          mounted() {},
          updated() {},
        },
      },
    },
  });

  await flushPromises();
  return wrapper;
}

describe('StudyDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无待复习但有单词时，主按钮显示继续复习', async () => {
    const wrapper = await createWrapper({ due: 0, weekDue: 0, total: 8 });
    expect(wrapper.text()).toContain('继续复习（8 个）');
    expect(wrapper.text()).toContain('总单词数');
  });

  it('点击主按钮继续复习时跳转到 continue scope', async () => {
    const wrapper = await createWrapper({ due: 0, weekDue: 0, total: 8 });
    const primaryBtn = wrapper.findAll('.el-btn')[0];
    await primaryBtn.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ path: '/study/session', query: { scope: 'continue' } });
  });

  it('点击今日已复习数字卡片进入今日已复习集合', async () => {
    const wrapper = await createWrapper({ todayReviewed: 2 });
    const cards = wrapper.findAll('.stat-card');
    await cards[2].trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ path: '/study/session', query: { scope: 'today-reviewed' } });
  });

  it('点击总单词数卡片进入全部单词集合', async () => {
    const wrapper = await createWrapper({ total: 8 });
    const cards = wrapper.findAll('.stat-card');
    await cards[3].trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ path: '/study/session', query: { scope: 'all' } });
  });

  it('点击学习中和已掌握卡片进入对应集合', async () => {
    const wrapper = await createWrapper({ learning: 5, known: 3 });
    const cards = wrapper.findAll('.stat-card');
    await cards[4].trigger('click');
    await cards[5].trigger('click');
    expect(pushMock).toHaveBeenNthCalledWith(1, { path: '/study/session', query: { scope: 'learning' } });
    expect(pushMock).toHaveBeenNthCalledWith(2, { path: '/study/session', query: { scope: 'known' } });
  });
});
