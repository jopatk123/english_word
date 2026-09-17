import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { User, Root, Word, WordRoot, WordReview } from '../models/index.js';
import { buildReviewApp, createReviewFixture, createTestSuffix } from './review-test-utils.js';

beforeEach(async () => {
  // 每个用例重置数据库并初始化表结构
  await createReviewFixture();
});

describe('GET /review/due 补足规则', () => {
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

  it('due 数量已达到 learning 的 1/3 时不补足', async () => {
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
    });

    // rawDue=0, learning=6, minDueCount=2, need=2, mergedIds=2
    // limit=1 应只返回 1 条
    const res = await request(app).get('/review/due?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
