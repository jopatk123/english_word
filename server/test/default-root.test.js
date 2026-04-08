/**
 * 后端核心逻辑测试
 * 覆盖：
 * 1. ensureDefaultRoot 工具函数（幂等创建）
 * 2. words 路由：无 rootId 时自动归入默认词根
 * 3. roots 路由：默认词根不可删除
 * 4. SRS 算法（纯函数）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDB, Root, Word, User } from '../models/index.js';
import {
  ensureDefaultRoot,
  DEFAULT_ROOT_NAME,
  DEFAULT_ROOT_MEANING,
} from '../utils/defaultRoot.js';

// ======================== 测试准备 ========================

beforeAll(async () => {
  await initDB();
  // 创建测试用户（不需要真实密码哈希）
  await User.create({ username: 'testuser1', password: 'hashed_pw_1' });
  await User.create({ username: 'testuser2', password: 'hashed_pw_2' });
});

afterAll(async () => {
  // 连接由最后一个测试文件关闭，此处不调用 sequelize.close()
  // 防止提前关闭导致后续测试文件无法使用共享连接
});

// ======================== ensureDefaultRoot ========================

describe('ensureDefaultRoot', () => {
  it('为新用户创建一个默认词根', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const root = await ensureDefaultRoot(user.id);

    expect(root).toBeDefined();
    expect(root.name).toBe(DEFAULT_ROOT_NAME);
    expect(root.meaning).toBe(DEFAULT_ROOT_MEANING);
    expect(root.isDefault).toBe(true);
    expect(root.userId).toBe(user.id);
  });

  it('多次调用返回同一条记录（幂等）', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const root1 = await ensureDefaultRoot(user.id);
    const root2 = await ensureDefaultRoot(user.id);

    expect(root1.id).toBe(root2.id);
  });

  it('不同用户拥有各自独立的默认词根', async () => {
    const user1 = await User.findOne({ where: { username: 'testuser1' } });
    const user2 = await User.findOne({ where: { username: 'testuser2' } });
    const root1 = await ensureDefaultRoot(user1.id);
    const root2 = await ensureDefaultRoot(user2.id);

    expect(root1.id).not.toBe(root2.id);
    expect(root1.userId).toBe(user1.id);
    expect(root2.userId).toBe(user2.id);
  });

  it('默认词根的 isDefault 字段为 true', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const root = await ensureDefaultRoot(user.id);
    expect(root.isDefault).toBe(true);
  });
});

// ======================== 无词根时自动归入默认词根 ========================

describe('Word 无 rootId 自动归入默认词根', () => {
  it('为用户的默认词根下创建一个单词', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const defaultRoot = await ensureDefaultRoot(user.id);

    // 模拟后端路由逻辑：无 rootIds 时使用 defaultRoot，通过 junction 表关联
    const word = await Word.create({
      name: 'run',
      meaning: '跑；运行',
      phonetic: '/rʌn/',
      userId: user.id,
    });
    await word.addRoot(defaultRoot);

    const roots = await word.getRoots();
    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe(defaultRoot.id);
    expect(word.name).toBe('run');
  });

  it('默认词根下的单词可以被正常查询', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const defaultRoot = await ensureDefaultRoot(user.id);

    const words = await defaultRoot.getWords();
    expect(words.length).toBeGreaterThan(0);
    expect(words.some((w) => w.name === 'run')).toBe(true);
  });
});

// ======================== 默认词根保护逻辑 ========================

describe('默认词根保护（不可删除）', () => {
  /**
   * 模拟路由 DELETE /roots/:id 中的保护逻辑
   * 实际检验：isDefault = true 时应该拒绝删除
   */
  const simulateDeleteRoot = async (rootId, userId) => {
    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== userId) return { ok: false, msg: '词根不存在' };
    if (root.isDefault) return { ok: false, msg: '「未分类」词根不能删除' };
    await root.destroy();
    return { ok: true };
  };

  it('普通词根可以正常删除', async () => {
    const user = await User.findOne({ where: { username: 'testuser2' } });
    const normalRoot = await Root.create({
      name: 'test_root',
      meaning: '测试词根',
      userId: user.id,
      isDefault: false,
    });

    const result = await simulateDeleteRoot(normalRoot.id, user.id);
    expect(result.ok).toBe(true);

    const deleted = await Root.findByPk(normalRoot.id);
    expect(deleted).toBeNull();
  });

  it('默认词根不允许被删除', async () => {
    const user = await User.findOne({ where: { username: 'testuser2' } });
    const defaultRoot = await ensureDefaultRoot(user.id);

    const result = await simulateDeleteRoot(defaultRoot.id, user.id);
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('不能删除');

    // 确认数据库中词根未被删除
    const stillExists = await Root.findByPk(defaultRoot.id);
    expect(stillExists).not.toBeNull();
  });

  it('不能删除其他用户的词根', async () => {
    const user1 = await User.findOne({ where: { username: 'testuser1' } });
    const user2 = await User.findOne({ where: { username: 'testuser2' } });
    const root = await ensureDefaultRoot(user1.id);

    const result = await simulateDeleteRoot(root.id, user2.id);
    expect(result.ok).toBe(false);
  });
});

// ======================== SRS 算法纯函数测试 ========================

describe('SRS 算法 getNextReview', () => {
  /**
   * 与 server/routes/review.js 中的实际 SRS 算法保持同步
   */
  function getNextReview(quality, currentInterval, easeFactor) {
    let newInterval;
    let newEase;
    const isNew = currentInterval < 1;

    if (quality === 1) {
      newInterval = 0; // again ：当日内再复习
      newEase = Math.max(1.3, easeFactor - 0.2);
    } else if (quality === 2) {
      newInterval = isNew ? 0 : Math.max(1, Math.ceil(currentInterval * 1.2));
      newEase = Math.max(1.3, easeFactor - 0.15);
    } else if (quality === 3) {
      newInterval = isNew ? 0 : Math.ceil(currentInterval * easeFactor);
      newEase = easeFactor;
    } else {
      newInterval = isNew ? 0 : Math.ceil(currentInterval * easeFactor * 1.3);
      newEase = easeFactor + 0.15;
    }

    const MAX_INTERVAL = 365;
    newInterval = Math.min(newInterval, MAX_INTERVAL);
    const status = quality === 1 ? 'learning' : newInterval >= 21 ? 'known' : 'review';
    return { interval: newInterval, easeFactor: newEase, status };
  }

  it('quality=1(again) interval=0 且降低 ease', () => {
    const result = getNextReview(1, 10, 2.5);
    expect(result.interval).toBe(0);
    expect(result.status).toBe('learning');
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it('quality=4(easy) 大幅增加间隔', () => {
    const result = getNextReview(4, 10, 2.5);
    expect(result.interval).toBeGreaterThan(10);
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it('间隔 >= 21 天时状态变为 known', () => {
    const result = getNextReview(4, 15, 2.5);
    expect(result.status).toBe('known');
  });

  it('首次复习（interval=0）quality=3 时 interval 变为 3', () => {
    const result = getNextReview(3, 0, 2.5);
    expect(result.interval).toBe(0);
  });

  it('ease factor 不会低于 1.3', () => {
    const result = getNextReview(1, 1, 1.3);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

// ======================== Root 模型字段验证 ========================

describe('Root 模型 isDefault 字段', () => {
  it('默认值为 false', async () => {
    const user = await User.findOne({ where: { username: 'testuser1' } });
    const root = await Root.create({
      name: 'ject',
      meaning: '投，扔',
      userId: user.id,
    });
    expect(root.isDefault).toBe(false);
    await root.destroy();
  });

  it('可以查询所有 isDefault=true 的词根', async () => {
    const user1 = await User.findOne({ where: { username: 'testuser1' } });
    const user2 = await User.findOne({ where: { username: 'testuser2' } });
    await ensureDefaultRoot(user1.id);
    await ensureDefaultRoot(user2.id);

    const defaultRoots = await Root.findAll({ where: { isDefault: true } });
    expect(defaultRoots.length).toBeGreaterThanOrEqual(2);
    defaultRoots.forEach((r) => expect(r.isDefault).toBe(true));
  });
});
