import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RootDetailView from '../RootDetailView.vue';

const routeMock = { params: { id: '42' } };

const {
  getRootMock,
  getRootsMock,
  getWordsMock,
  createWordMock,
  updateWordMock,
  deleteWordMock,
  moveWordMock,
  elMessage,
  elMessageBox,
} = vi.hoisted(() => ({
  getRootMock: vi.fn(),
  getRootsMock: vi.fn(),
  getWordsMock: vi.fn(),
  createWordMock: vi.fn(),
  updateWordMock: vi.fn(),
  deleteWordMock: vi.fn(),
  moveWordMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  elMessageBox: {
    confirm: vi.fn(),
  },
}));

const routerMock = { push: vi.fn() };

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

vi.mock('../../api/index.js', () => ({
  getRoot: (...args) => getRootMock(...args),
  getRoots: (...args) => getRootsMock(...args),
  getWords: (...args) => getWordsMock(...args),
  createWord: (...args) => createWordMock(...args),
  updateWord: (...args) => updateWordMock(...args),
  deleteWord: (...args) => deleteWordMock(...args),
  moveWord: (...args) => moveWordMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
  ElMessageBox: elMessageBox,
}));

const globalStubs = {
  SpeakButton: {
    template: '<span class="speak-button-stub" />',
  },
  'el-breadcrumb': {
    template: '<nav class="el-breadcrumb-stub"><slot /></nav>',
  },
  'el-breadcrumb-item': {
    template: '<span class="el-breadcrumb-item-stub"><slot /></span>',
  },
  'el-card': {
    template: '<section class="el-card-stub"><slot name="header" /><slot /></section>',
  },
  'el-table': {
    name: 'ElTableStub',
    props: ['data'],
    emits: ['selection-change'],
    methods: {
      clearSelection() {},
    },
    template: '<div class="el-table-stub"><slot /></div>',
  },
  'el-table-column': {
    template: '<div class="el-table-column-stub" />',
  },
  'el-link': {
    emits: ['click'],
    template: '<button class="el-link-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-button': {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template:
      '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
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
  'el-input': {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input class="el-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  'el-select': {
    props: ['modelValue', 'loading'],
    emits: ['update:modelValue'],
    template:
      '<select class="el-select-stub" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value ? Number($event.target.value) : null)"><slot /></select>',
  },
  'el-option': {
    props: ['label', 'value'],
    template: '<option class="el-option-stub" :value="value">{{ label }}</option>',
  },
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

const root = {
  id: 42,
  name: '-ate',
  meaning: '使成为，动词后缀',
  remark: '暂无备注',
};

const words = [
  { id: 1, name: 'climate', meaning: 'n. 气候；风气，环境', phonetic: '/ˈklaɪmət/', exampleCount: 1, remark: '' },
  {
    id: 2,
    name: 'duplicate',
    meaning: 'v. 复制 n. 副本 adj. 复制的',
    phonetic: '/ˈduːplɪkeɪt/',
    exampleCount: 3,
    remark: '',
  },
  {
    id: 3,
    name: 'complicate',
    meaning: 'v. 使复杂化 adj. 复杂的',
    phonetic: '/ˈkɒmplɪkeɪt/',
    exampleCount: 2,
    remark: '',
  },
];

async function createWrapper() {
  getRootMock.mockResolvedValue({ data: root });
  getRootsMock.mockResolvedValue({ data: [] });
  getWordsMock
    .mockResolvedValueOnce({ data: words })
    .mockResolvedValueOnce({ data: words.slice(2) });
  createWordMock.mockResolvedValue({ msg: '添加成功' });
  updateWordMock.mockResolvedValue({});
  deleteWordMock.mockResolvedValue({});
  moveWordMock.mockResolvedValue({});
  elMessageBox.confirm.mockResolvedValue();

  const wrapper = mount(RootDetailView, {
    props: { id: '42' },
    global: {
      stubs: globalStubs,
      mocks: {
        $router: routerMock,
      },
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

describe('RootDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.params.id = '42';
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('supports batch deleting selected words inside a root', async () => {
    const wrapper = await createWrapper();

    expect(wrapper.find('.root-toolbar').exists()).toBe(false);

    const table = wrapper.findComponent({ name: 'ElTableStub' });
    table.vm.$emit('selection-change', words.slice(0, 2));
    await flushPromises();

    const toolbar = wrapper.find('.root-toolbar');
    expect(toolbar.exists()).toBe(true);
    expect(toolbar.text()).toContain('已选 2 个单词');

    const batchDeleteButton = toolbar.find('button.el-button-stub');
    expect(batchDeleteButton.exists()).toBe(true);

    await batchDeleteButton.trigger('click');
    await flushPromises();

    expect(elMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('确定删除选中的 2 个单词'),
      '确认批量删除',
      expect.objectContaining({ type: 'warning' })
    );
    expect(deleteWordMock).toHaveBeenNthCalledWith(1, 1);
    expect(deleteWordMock).toHaveBeenNthCalledWith(2, 2);
    expect(elMessage.success).toHaveBeenCalledWith('已删除 2 个单词');
    expect(getWordsMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.root-toolbar').exists()).toBe(false);

    wrapper.unmount();
  });
});