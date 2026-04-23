import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';

const routeMock = reactive({ path: '/' });
const routerPushMock = vi.fn();

const {
  subscribeUserSessionChangesMock,
  notifyUserSessionChangedMock,
  getAuthRedirectPathMock,
  isAdminRoutePathMock,
} = vi.hoisted(() => ({
  subscribeUserSessionChangesMock: vi.fn(() => () => {}),
  notifyUserSessionChangedMock: vi.fn(),
  getAuthRedirectPathMock: vi.fn(() => null),
  isAdminRoutePathMock: vi.fn((path) => path.startsWith('/super-admin')),
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('../utils/authSync.js', () => ({
  notifyUserSessionChanged: (...args) => notifyUserSessionChangedMock(...args),
  subscribeUserSessionChanges: (...args) => subscribeUserSessionChangesMock(...args),
}));

vi.mock('../utils/authRouteAccess.js', () => ({
  getAuthRedirectPath: (...args) => getAuthRedirectPathMock(...args),
  isAdminRoutePath: (...args) => isAdminRoutePathMock(...args),
}));

vi.mock('../components/AlarmClock.vue', () => ({
  default: {
    template: '<div class="alarm-clock-stub" />',
  },
}));

const globalStubs = {
  'el-header': {
    template: '<header class="el-header-stub"><slot /></header>',
  },
  'el-main': {
    template: '<main class="el-main-stub"><slot /></main>',
  },
  'el-button': {
    props: ['link'],
    emits: ['click'],
    template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>',
  },
  'router-view': {
    template: '<div class="router-view-stub" />',
  },
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorage());
    routeMock.path = '/';
    localStorage.setItem('user', JSON.stringify({ username: 'Alice' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the branded header on normal routes', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: globalStubs,
      },
    });

    await flush();
    await nextTick();

    expect(wrapper.find('.header-brand').exists()).toBe(true);
    expect(wrapper.text()).toContain('词根背单词工具');
    expect(wrapper.find('.header-user').text()).toContain('Alice');

    wrapper.unmount();
  });

  it('keeps the admin route header-free', async () => {
    routeMock.path = '/super-admin';

    const wrapper = mount(App, {
      global: {
        stubs: globalStubs,
      },
    });

    await flush();
    await nextTick();

    expect(wrapper.find('.app-header').exists()).toBe(false);
    expect(wrapper.find('.router-view-stub').exists()).toBe(true);

    wrapper.unmount();
  });
});