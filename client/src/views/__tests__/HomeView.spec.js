import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from '../HomeView.vue';

const { getRootsMock, getWordsMock, elMessage, elMessageBox } = vi.hoisted(() => ({
  getRootsMock: vi.fn(),
  getWordsMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  elMessageBox: {
    confirm: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../api/index.js', () => ({
  getRoots: (...args) => getRootsMock(...args),
  getWords: (...args) => getWordsMock(...args),
  createRoot: vi.fn(),
  updateRoot: vi.fn(),
  deleteRoot: vi.fn(),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: elMessageBox,
}));

const globalStubs = {
  Search: {
    template: '<i class="search-icon-stub" />',
  },
  SpeakButton: {
    template: '<span class="speak-button-stub" />',
  },
  'el-breadcrumb': {
    template: '<nav class="el-breadcrumb-stub"><slot /></nav>',
  },
  'el-breadcrumb-item': {
    template: '<span class="el-breadcrumb-item-stub"><slot /></span>',
  },
  'el-input': {
    props: ['modelValue'],
    emits: ['update:modelValue', 'clear', 'keyup.enter'],
    template:
      '<div class="el-input-stub"><input class="el-input-inner" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><div class="el-input-prefix"><slot name="prefix" /></div><div class="el-input-append"><slot name="append" /></div></div>',
  },
  'el-button': {
    emits: ['click'],
    template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-table': {
    template: '<div class="el-table-stub" />',
  },
  'el-table-column': {
    template: '<div class="el-table-column-stub" />',
  },
  'el-link': {
    emits: ['click'],
    template: '<button class="el-link-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-tag': {
    template: '<span class="el-tag-stub"><slot /></span>',
  },
  'el-dialog': {
    template: '<div class="el-dialog-stub"><slot /><slot name="footer" /></div>',
  },
  'el-form': {
    template: '<form class="el-form-stub"><slot /></form>',
  },
  'el-form-item': {
    template: '<div class="el-form-item-stub"><slot /></div>',
  },
  'el-icon': {
    template: '<span class="el-icon-stub"><slot /></span>',
  },
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('HomeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRootsMock.mockResolvedValue({ data: [] });
    getWordsMock.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('search word failure clears stale results and shows an error message', async () => {
    const wrapper = mount(HomeView, {
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

    const input = wrapper.find('input.el-input-inner');
    await input.setValue('engine');
    await wrapper.find('.el-input-append .el-button-stub').trigger('click');
    await flushPromises();

    expect(getWordsMock).toHaveBeenCalledWith({ keyword: 'engine' });
    expect(elMessage.error).toHaveBeenCalledWith('搜索单词失败，请稍后重试');

    wrapper.unmount();
  });
});