import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { User, Root, Word, WordRoot, WordReview } from '../models/index.js';
import { buildReviewApp, createReviewFixture, createTestSuffix } from './review-test-utils.js';

beforeEach(async () => {
  // 每个用例重置数据库并初始化表结构
  await createReviewFixture();
});

describe('GET /review/due 补足规则', () => {
  const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 辅助：为指定用户创建 N 个 learning 单词，dueDate 均在未来，不在原始 due 范围内
  async function createLearningWords({ userId, rootId, count, lastReviewedAt = null, prefix }) {
    const words = [];
    for (let i = 0; i < count; i++) {
      const w = await Word.create({
        name: `${prefix}_${i}_${createTestSuffix()}`,
        meaning: `learning-${i}`,
        userId,
      });
      await WordRoot.create({ wordId: w.id, rootId });
      await WordReview.create({
        userId,
        wordId: w.id,
        status: 'review',
        interval: 5,
        easeFactor: 2.5,
        dueDate: '2099-01-01',
        reviewCount: 1,
        lastReviewedAt,
      });
      words.push(w);
    }
    return words;
  }

  it('due 数量少于 learning 的 1/3 时，从 learning 中补足到 ceil(learning/3)', async () => {
    const user = await User.create({
      username: `fill_basic_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `fill_basic_root_${createTestSuffix()}`,
      meaning: '补足基础',
      userId: user.id,
    });

    // 6 个 learning 单词，dueDate 均在未来，不在原始 due 中
    const words = await createLearningWords({
      userId: user.id,
      rootId: root.id,
      count: 6,
      prefix: 'fill_basic_w',
      // 最近复习过，只验证补足，不触发防饿死
      lastReviewedAt: daysAgo(2),
    });

    // rawDue=0, learning=6, minDueCount=ceil(6/3)=2, need=2
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);

    const ids = res.body.data.map((r) => r.wordId);
    const wordIds = new Set(words.map((w) => w.id));
    ids.forEach((id) => {
      expect(wordIds.has(id)).toBe(true);
    });
  });

  it('补足优先选取最近复习时间更早的单词（NULL 最优先）', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
    try {
      const user = await User.create({
        username: `fill_order_${createTestSuffix()}`,
        password: 'x',
      });
      const app = buildReviewApp(user.id);
      const root = await Root.create({
        name: `fill_order_root_${createTestSuffix()}`,
        meaning: '补足排序',
        userId: user.id,
      });

      // 4 个 learning 单词，lastReviewedAt 不同：
      // A: 昨天（2026-04-09），B: 前天（2026-04-08），C: 从未复习（null），D: 上周（2026-04-03）
      const mkWord = async (label, lastReviewedAt) => {
        const w = await Word.create({
          name: `${label}_${createTestSuffix()}`,
          meaning: label,
          userId: user.id,
        });
        await WordRoot.create({ wordId: w.id, rootId: root.id });
        await WordReview.create({
          userId: user.id,
          wordId: w.id,
          status: 'review',
          interval: 5,
          easeFactor: 2.5,
          dueDate: '2099-01-01',
          reviewCount: 1,
          lastReviewedAt,
        });
        return w;
      };

      const wordA = await mkWord('yesterday', new Date('2026-04-09T10:00:00Z'));
      const wordB = await mkWord('dayBefore', new Date('2026-04-08T10:00:00Z'));
      const wordC = await mkWord('never', null);
      const wordD = await mkWord('lastWeek', new Date('2026-04-03T10:00:00Z'));

      // rawDue=0, learning=4, minDueCount=ceil(4/3)=2, need=2
      // 预期排序：C(NULL) → D(上周) → B(前天) → A(昨天)，取前 2 个
      const res = await request(app).get('/review/due');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const ids = res.body.data.map((r) => r.wordId);
      expect(ids).toEqual([wordC.id, wordD.id]);
      // 时间更晚的 A、B 不应被补足选中
      expect(ids).not.toContain(wordA.id);
      expect(ids).not.toContain(wordB.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('真到期已达到 learning 的 1/3 且未到期单词最近复习过时不补足', async () => {
    const user = await User.create({
      username: `fill_none_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `fill_none_root_${createTestSuffix()}`,
      meaning: '不补足',
      userId: user.id,
    });

    // 3 个 due 单词（dueDate=过去，进入原始 due）
    const dueWords = [];
    for (let i = 0; i < 3; i++) {
      const w = await Word.create({
        name: `fill_none_due_${i}_${createTestSuffix()}`,
        meaning: `due-${i}`,
        userId: user.id,
      });
      await WordRoot.create({ wordId: w.id, rootId: root.id });
      await WordReview.create({
        userId: user.id,
        wordId: w.id,
        status: 'review',
        interval: 5,
        easeFactor: 2.5,
        dueDate: '2000-01-01',
        reviewCount: 1,
      });
      dueWords.push(w);
    }

    // 6 个 learning 单词（dueDate=未来，不在 due 中）
    const learningWords = await createLearningWords({
      userId: user.id,
      rootId: root.id,
      count: 6,
      prefix: 'fill_none_learning',
      lastReviewedAt: daysAgo(2),
    });

    // rawDue=3, learning=9, minDueCount=ceil(9/3)=3, need=0
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);

    const ids = res.body.data.map((r) => r.wordId);
    const learningIds = new Set(learningWords.map((w) => w.id));
    // 不应包含任何 learning 补足单词
    ids.forEach((id) => {
      expect(learningIds.has(id)).toBe(false);
    });
  });

  it('补足排除已在 due 中的单词，不重复返回', async () => {
    const user = await User.create({
      username: `fill_dedup_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `fill_dedup_root_${createTestSuffix()}`,
      meaning: '去重',
      userId: user.id,
    });

    // 1 个 due 单词（既在 due 又是 learning 状态——status=review, dueDate=过去）
    const dueWord = await Word.create({
      name: `fill_dedup_due_${createTestSuffix()}`,
      meaning: 'due',
      userId: user.id,
    });
    await WordRoot.create({ wordId: dueWord.id, rootId: root.id });
    await WordReview.create({
      userId: user.id,
      wordId: dueWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2000-01-01',
      reviewCount: 1,
    });

    // 5 个未到期 learning 单词
    const learningWords = await createLearningWords({
      userId: user.id,
      rootId: root.id,
      count: 5,
      prefix: 'fill_dedup_learning',
      lastReviewedAt: daysAgo(2),
    });

    // rawDue=1, learning=6, minDueCount=ceil(6/3)=2, need=1
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);

    // dueWord 出现且仅出现一次，另一个来自 learning
    const ids = res.body.data.map((r) => r.wordId);
    const dueWordOccurrences = ids.filter((id) => id === dueWord.id).length;
    expect(dueWordOccurrences).toBe(1);

    const learningIds = new Set(learningWords.map((w) => w.id));
    const fillers = ids.filter((id) => learningIds.has(id));
    expect(fillers.length).toBe(1);
  });

  it('limit 在补足后的合并列表上生效', async () => {
    const user = await User.create({
      username: `fill_limit_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `fill_limit_root_${createTestSuffix()}`,
      meaning: '分页',
      userId: user.id,
    });

    // 6 个 learning 单词，补足后 mergedIds 长度为 2
    await createLearningWords({
      userId: user.id,
      rootId: root.id,
      count: 6,
      prefix: 'fill_limit_w',
      lastReviewedAt: daysAgo(2),
    });

    // rawDue=0, learning=6, minDueCount=2, need=2, mergedIds=2
    // limit=1 应只返回 1 条
    const res = await request(app).get('/review/due?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  async function createReviewWord({
    userId,
    rootId,
    label,
    status = 'review',
    dueDate = '2099-01-01',
    lastReviewedAt = null,
    interval = 30,
  }) {
    const word = await Word.create({
      name: `${label}_${createTestSuffix()}`,
      meaning: label,
      userId,
    });
    await WordRoot.create({ wordId: word.id, rootId });
    await WordReview.create({
      userId,
      wordId: word.id,
      status,
      interval,
      easeFactor: 2.5,
      dueDate,
      reviewCount: 1,
      lastReviewedAt,
    });
    return word;
  }

  it('真到期已满时仍注入最久未复习的非 known，且不带入 known 或最近复习过的词', async () => {
    const user = await User.create({
      username: `guard_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `guard_root_${createTestSuffix()}`,
      meaning: '防饿死',
      userId: user.id,
    });

    const dueWords = [];
    for (let i = 0; i < 3; i++) {
      dueWords.push(
        await createReviewWord({
          userId: user.id,
          rootId: root.id,
          label: `guard_due_${i}`,
          dueDate: '2000-01-01',
          lastReviewedAt: daysAgo(1),
        })
      );
    }
    const stale = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'guard_stale',
      interval: 365,
      lastReviewedAt: daysAgo(40),
    });
    const recent = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'guard_recent',
      lastReviewedAt: daysAgo(2),
    });
    const known = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'guard_known',
      status: 'known',
      interval: 365,
      lastReviewedAt: daysAgo(400),
    });

    // learning=5，minDue=2，真到期=3 >= 2，补足关闭。
    // 防饿死名额 ceil(2*0.15)=1，只注入最久未复习的非 known。
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toHaveLength(4);
    expect(ids.slice(0, 3).sort()).toEqual(dueWords.map((word) => word.id).sort());
    expect(ids[3]).toBe(stale.id);
    expect(ids).not.toContain(recent.id);
    expect(ids).not.toContain(known.id);

    const stats = await request(app).get('/review/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data.due).toBe(ids.length);
    expect(stats.body.data.overdue).toBe(3);
    expect(stats.body.data.todayDue).toBe(0);
    expect(stats.body.data.known).toBe(1);
  });

  it('真到期不足时补足仍优先最久未复习，防饿死在补足之外再加久未复习的词', async () => {
    const user = await User.create({
      username: `guard_fill_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `guard_fill_root_${createTestSuffix()}`,
      meaning: '补足加防饿死',
      userId: user.id,
    });

    const oldest = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'fill_oldest',
      lastReviewedAt: daysAgo(90),
    });
    const older = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'fill_older',
      lastReviewedAt: daysAgo(40),
    });
    const stale = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'fill_stale',
      lastReviewedAt: daysAgo(25),
    });
    const known = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'fill_known',
      status: 'known',
      interval: 365,
      lastReviewedAt: daysAgo(500),
    });

    // learning=3，minDue=1，真到期=0，补足 1 个最久的，防饿死再加 1 个。
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toEqual([oldest.id, older.id]);
    expect(ids).not.toContain(stale.id);
    expect(ids).not.toContain(known.id);

    const stats = await request(app).get('/review/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data.due).toBe(2);
    expect(stats.body.data.todayDue).toBe(0);
    expect(stats.body.data.overdue).toBe(0);
  });

  it('防饿死名额按最久未复习排序，且不会重复已在真到期中的单词', async () => {
    const user = await User.create({
      username: `guard_order_${createTestSuffix()}`,
      password: 'x',
    });
    const app = buildReviewApp(user.id);
    const root = await Root.create({
      name: `guard_order_root_${createTestSuffix()}`,
      meaning: '防饿死排序',
      userId: user.id,
    });

    // learning 需要 >= 19 才会让 minDue=7、防饿死名额=2。
    const dueWords = [];
    for (let i = 0; i < 7; i++) {
      dueWords.push(
        await createReviewWord({
          userId: user.id,
          rootId: root.id,
          label: `order_due_${i}`,
          dueDate: '2000-01-01',
          lastReviewedAt: i === 0 ? daysAgo(80) : daysAgo(1),
        })
      );
    }
    const oldestFuture = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'order_oldest',
      lastReviewedAt: daysAgo(60),
    });
    const olderFuture = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'order_older',
      lastReviewedAt: daysAgo(40),
    });
    const newerStale = await createReviewWord({
      userId: user.id,
      rootId: root.id,
      label: 'order_newer_stale',
      lastReviewedAt: daysAgo(25),
    });
    for (let i = 0; i < 9; i++) {
      await createReviewWord({
        userId: user.id,
        rootId: root.id,
        label: `order_recent_${i}`,
        lastReviewedAt: daysAgo(3),
      });
    }

    // 7 个真到期 + 12 个未到期非 known = learning 19，minDue=7，补足关闭，名额=2。
    const res = await request(app).get('/review/due');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toHaveLength(9);
    expect(ids.slice(0, 7).sort()).toEqual(dueWords.map((word) => word.id).sort());
    expect(ids.slice(7)).toEqual([oldestFuture.id, olderFuture.id]);
    expect(ids).not.toContain(newerStale.id);
    expect(ids.filter((id) => id === dueWords[0].id)).toHaveLength(1);

    const stats = await request(app).get('/review/stats');
    expect(stats.body.data.due).toBe(9);
    expect(stats.body.data.overdue).toBe(7);
    expect(stats.body.data.todayDue).toBe(0);
  });
});
