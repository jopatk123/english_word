import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppMobileNav from '../AppMobileNav.vue';

describe('AppMobileNav', () => {
  it('emits the selected tab and opens more as a sheet', async () => {
    const wrapper = mount(AppMobileNav, {
      attachTo: document.body,
      props: {
        visible: true,
        active: 'home',
        moreOpen: true,
        username: 'Alice',
      },
    });

    const tabs = wrapper.findAll('.mobile-tab');
    await tabs[1].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['study']);

    await tabs[3].trigger('click');
    expect(wrapper.emitted('select')[1]).toEqual(['more']);
    expect(document.body.textContent).toContain('Alice');
    expect(document.body.textContent).toContain('AI 配置');
    wrapper.unmount();
  });
});
