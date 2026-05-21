import { mount } from '@vue/test-utils';
import { computed, h, inject, provide } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from '../HomeView.vue';

const { getRootsMock, getWordsMock, deleteRootMock, elMessage, elMessageBox, routerPushMock } =
  vi.hoisted(() => ({
    getRootsMock: vi.fn(),
    getWordsMock: vi.fn(),
    deleteRootMock: vi.fn(),
    elMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
    elMessageBox: {
      confirm: vi.fn(),
    },
    routerPushMock: vi.fn(),
  }));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('../../api/index.js', () => ({
  getRoots: (...args) => getRootsMock(...args),
  getWords: (...args) => getWordsMock(...args),
  createRoot: vi.fn(),
  updateRoot: vi.fn(),
  deleteRoot: (...args) => deleteRootMock(...args),
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
    props: ['disabled', 'loading'],
    emits: ['click'],
    template:
      '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-table': {
    name: 'ElTableStub',
    props: ['data'],
    emits: ['selection-change'],
    setup(props, { slots, expose }) {
      provide('elTableData', computed(() => props.data ?? []));
      expose({
        clearSelection() {},
        toggleAllSelection() {},
      });
      return () => h('div', { class: 'el-table-stub' }, slots.default?.());
    },
  },
  'el-table-column': {
    props: ['prop', 'type'],
    setup(props, { slots }) {
      const elTableData = inject('elTableData', computed(() => []));
      return () => {
        if (props.type === 'selection') {
          return null;
        }

        return h(
          'div',
          { class: 'el-table-column-stub' },
          elTableData.value.map((row, index) => {
            if (slots.default) {
              return h(
                'div',
                { key: row?.id ?? row?.name ?? index, class: 'el-table-row-stub' },
                slots.default({ row })
              );
            }

            if (props.prop) {
              return h(
                'span',
                { key: row?.id ?? row?.name ?? index, class: 'el-table-cell-text' },
                row?.[props.prop]
              );
            }

            return null;
          })
        );
      };
    },
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
    deleteRootMock.mockResolvedValue({});
    elMessageBox.confirm.mockResolvedValue();
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
    expect(routerPushMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('explicit search falls back to AI search when no exact local word exists', async () => {
    getWordsMock.mockResolvedValue({
      data: [{ id: 1, name: 'tunneled', meaning: '挖隧道', roots: [] }],
    });

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
    await input.setValue('tunnel');
    await wrapper.find('.el-input-append .el-button-stub').trigger('click');
    await flushPromises();

    expect(getWordsMock).toHaveBeenCalledWith({ keyword: 'tunnel' });
    expect(routerPushMock).toHaveBeenCalledWith({ path: '/search', query: { q: 'tunnel' } });

    wrapper.unmount();
  });

  it('explicit search stays on home when the exact local word exists', async () => {
    getWordsMock.mockResolvedValue({
      data: [{ id: 1, name: 'tunnel', meaning: '隧道', roots: [] }],
    });

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
    await input.setValue('tunnel');
    await wrapper.find('.el-input-append .el-button-stub').trigger('click');
    await flushPromises();

    expect(routerPushMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('allows clicking the word name to open the word detail page', async () => {
    getWordsMock.mockResolvedValue({
      data: [{ id: 1, name: 'wallet', meaning: '钱包', roots: [] }],
    });

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
    await input.setValue('wallet');
    await wrapper.find('.el-input-append .el-button-stub').trigger('click');
    await flushPromises();

    routerPushMock.mockClear();

    const wordLink = wrapper
      .findAll('.el-link-stub')
      .find((node) => node.text().includes('wallet'));

    expect(wordLink).toBeDefined();

    await wordLink.trigger('click');

    expect(routerPushMock).toHaveBeenCalledWith('/word/1');

    wrapper.unmount();
  });

  it('supports batch deleting selected roots from the list', async () => {
    const roots = [
      { id: 1, name: '-ain', meaning: '人或物', wordCount: 1, remark: '' },
      { id: 2, name: '-al', meaning: '属于', wordCount: 1, remark: '' },
      { id: 3, name: '未分类', meaning: '默认词根', wordCount: 0, remark: '', isDefault: true },
    ];
    getRootsMock.mockResolvedValueOnce({ data: roots }).mockResolvedValueOnce({ data: [] });

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

    expect(wrapper.find('.root-toolbar').exists()).toBe(false);

    const table = wrapper.findComponent({ name: 'ElTableStub' });
    table.vm.$emit('selection-change', roots.slice(0, 2));
    await flushPromises();

    const batchDeleteButton = wrapper.find('.root-toolbar button.el-button-stub');

    expect(batchDeleteButton.exists()).toBe(true);
    await batchDeleteButton.trigger('click');
    await flushPromises();

    expect(elMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('确定删除选中的 2 个词根'),
      '确认批量删除',
      expect.objectContaining({ type: 'warning' })
    );
    expect(deleteRootMock).toHaveBeenNthCalledWith(1, 1);
    expect(deleteRootMock).toHaveBeenNthCalledWith(2, 2);
    expect(elMessage.success).toHaveBeenCalledWith('已删除 2 个词根');
    expect(getRootsMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
