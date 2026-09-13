import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiTokensView from '../ApiTokensView.vue';

const { listApiTokensMock, createApiTokenMock, revokeApiTokenMock, elMessage } = vi.hoisted(() => ({
  listApiTokensMock: vi.fn(),
  createApiTokenMock: vi.fn(),
  revokeApiTokenMock: vi.fn(),
  elMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../api/index.js', () => ({
  listApiTokens: (...args) => listApiTokensMock(...args),
  createApiToken: (...args) => createApiTokenMock(...args),
  revokeApiToken: (...args) => revokeApiTokenMock(...args),
}));

vi.mock('element-plus', () => ({
  ElMessage: elMessage,
}));

const globalStubs = {
  'el-breadcrumb': { template: '<nav><slot /></nav>' },
  'el-breadcrumb-item': { template: '<span><slot /></span>' },
  'el-card': { template: '<section><slot name="header" /><slot /></section>' },
  'el-button': {
    props: ['loading', 'type', 'link'],
    emits: ['click'],
    template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-empty': {
    props: ['description'],
    template: '<div class="el-empty-stub">{{ description }}<slot /></div>',
  },
  'el-table': {
    props: ['data'],
    template: '<div class="el-table-stub"><slot /></div>',
  },
  'el-table-column': {
    template: '<div class="el-table-column-stub"><slot name="default" :row="stubRow" /></div>',
    data() {
      return {
        stubRow: {
          id: 1,
          name: '本地脚本',
          tokenPrefix: 'ewt_ab12cd34ef',
          createdAt: '2026-09-13T00:00:00.000Z',
          lastUsedAt: null,
          expiresAt: null,
        },
      };
    },
  },
  'el-tag': { template: '<span><slot /></span>' },
  'el-popconfirm': {
    emits: ['confirm'],
    template:
      '<div class="el-popconfirm-stub"><slot name="reference" /><button class="confirm-revoke" @click="$emit(\'confirm\')">ok</button></div>',
  },
  'el-dialog': {
    props: ['modelValue'],
    template: '<div v-if="modelValue" class="el-dialog-stub"><slot /><slot name="footer" /></div>',
  },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-input': {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input class="name-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  'el-date-picker': { template: '<input class="date-picker-stub" />' },
  'el-alert': { template: '<div class="el-alert-stub"><slot /></div>' },
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const sampleTokens = [
  {
    id: 1,
    name: '本地脚本',
    tokenPrefix: 'ewt_ab12cd34ef',
    createdAt: '2026-09-13T00:00:00.000Z',
    lastUsedAt: null,
    expiresAt: null,
  },
];

describe('ApiTokensView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApiTokensMock.mockResolvedValue({ data: sampleTokens });
    createApiTokenMock.mockResolvedValue({
      data: { id: 2, token: `ewt_${'ab'.repeat(32)}`, tokenPrefix: 'ewt_abababababab' },
    });
    revokeApiTokenMock.mockResolvedValue({ data: null });
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('挂载后加载 Token 列表', async () => {
    const wrapper = mount(ApiTokensView, { global: { stubs: globalStubs } });
    await flushPromises();

    expect(listApiTokensMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('API Token 管理');
    expect(wrapper.text()).toContain('本地脚本');
    expect(wrapper.text()).toContain('ewt_ab12cd34ef');
  });

  it('空列表时展示创建入口', async () => {
    listApiTokensMock.mockResolvedValue({ data: [] });
    const wrapper = mount(ApiTokensView, { global: { stubs: globalStubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('暂无 API Token');
  });

  it('创建成功后只展示一次明文并可复制', async () => {
    const wrapper = mount(ApiTokensView, { global: { stubs: globalStubs } });
    await flushPromises();

    const createBtn = wrapper
      .findAll('.el-button-stub')
      .find((b) => b.text().includes('创建新 Token'));
    await createBtn.trigger('click');
    await wrapper.find('.name-input').setValue('Agent');
    const submitBtn = wrapper.findAll('.el-button-stub').find((b) => b.text() === '创建');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(createApiTokenMock).toHaveBeenCalledWith({ name: 'Agent', expiresAt: undefined });
    expect(wrapper.text()).toContain(`ewt_${'ab'.repeat(32)}`);
    expect(elMessage.success).toHaveBeenCalledWith('Token 创建成功');

    const copyBtn = wrapper.findAll('.el-button-stub').find((b) => b.text() === '复制');
    await copyBtn.trigger('click');
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`ewt_${'ab'.repeat(32)}`);
  });

  it('可以撤销 Token', async () => {
    const wrapper = mount(ApiTokensView, { global: { stubs: globalStubs } });
    await flushPromises();

    await wrapper.get('.confirm-revoke').trigger('click');
    await flushPromises();

    expect(revokeApiTokenMock).toHaveBeenCalledWith(1);
    expect(elMessage.success).toHaveBeenCalledWith('Token 已撤销');
    expect(listApiTokensMock.mock.calls.length).toBeGreaterThan(1);
  });
});
