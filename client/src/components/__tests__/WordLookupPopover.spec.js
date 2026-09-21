import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import WordLookupPopover from '../WordLookupPopover.vue';
import { clearWordLookupSession, wordLookupState } from '../../composables/wordLookup.js';

vi.mock('../../api/index.js', () => ({
  lookupWord: vi.fn(),
  createWord: vi.fn(),
}));

vi.mock('../../utils/aiSettings.js', () => ({
  loadAiSettings: () => ({}),
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/word/:id', component: { template: '<div />' } },
    { path: '/search', component: { template: '<div />' } },
  ],
});

const mountPopover = () =>
  mount(WordLookupPopover, {
    global: {
      plugins: [router],
      stubs: {
        SpeakButton: { template: '<button class="speak-stub" />' },
      },
    },
    attachTo: document.body,
  });

describe('WordLookupPopover', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    clearWordLookupSession();
    wordLookupState.visible = true;
    wordLookupState.word = 'inspect';
    wordLookupState.anchor = document.body;
    wordLookupState.result = {
      word: 'inspect',
      phonetic: '/ɪnˈspekt/',
      meaning: '检查',
      partOfSpeech: [],
      source: 'library',
      wordId: 7,
    };
    await router.push('/');
  });

  it('在新标签页打开词库详情', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mountPopover();
    await wrapper.vm.$nextTick();

    document.body.querySelector('button.lookup-action').click();

    expect(open).toHaveBeenCalledWith('/word/7', '_blank', 'noopener,noreferrer');
    expect(wordLookupState.visible).toBe(false);
    wrapper.unmount();
  });

  it('在新标签页打开完整分析', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mountPopover();
    await wrapper.vm.$nextTick();

    const actions = document.body.querySelectorAll('button.lookup-action');
    actions[1].click();

    expect(open).toHaveBeenCalledWith('/search?q=inspect', '_blank', 'noopener,noreferrer');
    wrapper.unmount();
  });
});
