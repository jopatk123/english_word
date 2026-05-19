import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRouteSourcesForTest,
  getRouteDisplayLabel,
  getRouteSource,
  rememberRouteSource,
} from '../navigationHistory.js';

describe('navigationHistory', () => {
  beforeEach(() => {
    clearRouteSourcesForTest();
  });

  it('按当前 fullPath 记录上一跳路由', () => {
    rememberRouteSource(
      {
        name: 'WordDetail',
        fullPath: '/word/1',
        path: '/word/1',
        params: { id: '1' },
      },
      {
        name: 'RootDetail',
        fullPath: '/root/7',
        path: '/root/7',
        params: { id: '7' },
      }
    );

    expect(getRouteSource('/word/1')).toMatchObject({
      name: 'RootDetail',
      fullPath: '/root/7',
      params: { id: '7' },
    });
  });

  it('忽略没有有效来源名的首屏进入', () => {
    rememberRouteSource(
      {
        name: 'WordDetail',
        fullPath: '/word/1',
        path: '/word/1',
      },
      {
        fullPath: '/',
        path: '/',
      }
    );

    expect(getRouteSource('/word/1')).toBe(null);
  });

  it('可以为词根详情生成带名称的面包屑标签', () => {
    expect(getRouteDisplayLabel({ name: 'RootDetail' }, { rootName: 'state' })).toBe(
      '词根：state'
    );
  });
});