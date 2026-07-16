import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { User, Root, Word, WordRoot, Example, WordReview } from '../models/index.js';
import { buildReviewApp, createReviewFixture, createTestSuffix } from './review-test-utils.js';

let fixture;

beforeEach(async () => {
  fixture = await createReviewFixture();
});

describe('GET /review/quiz-choices/:wordId', () => {
  it('只返回当前用户自己的正确项和干扰项', async () => {
    const isolatedUser = await User.create({
      username: `quiz_user_${createTestSuffix()}`,
      password: 'x',
    });
    const isolatedRoot = await Root.create({
      name: `quiz_root_${createTestSuffix()}`,
      meaning: '隔离词根',
      userId: isolatedUser.id,
    });
    const isolatedWord = await Word.create({
      name: `quiz_target_${createTestSuffix()}`,
      meaning: '目标释义',
      userId: isolatedUser.id,
    });
    const isolatedDistractor = await Word.create({
      name: `quiz_local_${createTestSuffix()}`,
      meaning: '本地干扰项',
      userId: isolatedUser.id,
    });
    const otherUser = await User.create({
      username: `quiz_other_${createTestSuffix()}`,
      password: 'x',
    });
    const otherRoot = await Root.create({
      name: `quiz_other_root_${createTestSuffix()}`,
      meaning: '他人词根',
      userId: otherUser.id,
    });
    const otherWord = await Word.create({
      name: `quiz_other_word_${createTestSuffix()}`,
      meaning: '他人释义',
      userId: otherUser.id,
    });

    await WordRoot.create({ wordId: isolatedWord.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: isolatedDistractor.id, rootId: isolatedRoot.id });
    await WordRoot.create({ wordId: otherWord.id, rootId: otherRoot.id });

    const isolatedApp = buildReviewApp(isolatedUser.id);
    const res = await request(isolatedApp).get(`/review/quiz-choices/${isolatedWord.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.correct.id).toBe(isolatedWord.id);
    expect(res.body.data.distractors.some((item) => item.id === isolatedDistractor.id)).toBe(true);
    expect(res.body.data.distractors.some((item) => item.id === otherWord.id)).toBe(false);
  });
});

describe('自动加入复习', () => {
  it('夹具中的单词默认已有复习记录', async () => {
    const review = await WordReview.findOne({
      where: { userId: fixture.userId, wordId: fixture.wordId },
    });
    expect(review).toBeTruthy();
    expect(review.status).toBe('new');
  });

  it('手动加入复习接口已移除', async () => {
    const res = await request(fixture.app).post('/review/enqueue').send({ rootId: fixture.rootId });
    expect(res.status).toBe(404);
  });
});

describe('GET /review/due', () => {
  it('返回今日待复习列表', async () => {
    const res = await request(fixture.app).get('/review/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('未来到期的单词不会进入今日待复习列表', async () => {
    const futureWord = await Word.create({
      name: `future_${createTestSuffix()}`,
      meaning: '未来到期',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: futureWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: futureWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-10',
      reviewCount: 1,
    });

    const res = await request(fixture.app).get('/review/due');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).not.toContain(futureWord.id);
  });

  it('limit=1 只返回 1 条', async () => {
    const res = await request(fixture.app).get('/review/due?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('新词 quality=3 后会等待 30 分钟才重新进入待复习', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T10:00:00Z'));

    try {
      const stepWord = await Word.create({
        name: `step_${createTestSuffix()}`,
        meaning: '短间隔',
        userId: fixture.userId,
      });
      await WordRoot.create({ wordId: stepWord.id, rootId: fixture.rootId });

      const resultRes = await request(fixture.app)
        .post(`/review/${stepWord.id}/result`)
        .send({ quality: 3 });
      expect(resultRes.status).toBe(200);
      expect(resultRes.body.data.interval).toBe(0);

      const immediateRes = await request(fixture.app).get('/review/due');
      const immediateIds = immediateRes.body.data.map((item) => item.wordId);
      expect(immediateIds).not.toContain(stepWord.id);

      vi.setSystemTime(new Date('2026-04-09T10:30:01Z'));
      const laterRes = await request(fixture.app).get('/review/due');
      const laterIds = laterRes.body.data.map((item) => item.wordId);
      expect(laterIds).toContain(stepWord.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scope=learning 仅返回未掌握单词', async () => {
    const knownWord = await Word.create({
      name: `known_${createTestSuffix()}`,
      meaning: '已掌握词',
      userId: fixture.userId,
    });
    const learningWord = await Word.create({
      name: `learning_${createTestSuffix()}`,
      meaning: '学习词',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 30,
      easeFactor: 2.8,
      dueDate: '2099-01-01',
      reviewCount: 5,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 3,
      easeFactor: 2.5,
      dueDate: '2099-01-01',
      reviewCount: 2,
    });

    const res = await request(fixture.app).get('/review/due?scope=learning');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(learningWord.id);
    expect(ids).not.toContain(knownWord.id);
  });

  it('scope=known 仅返回已掌握单词', async () => {
    const knownWord = await Word.create({
      name: `known_only_${createTestSuffix()}`,
      meaning: '已掌握',
      userId: fixture.userId,
    });
    const learningWord = await Word.create({
      name: `learning_only_${createTestSuffix()}`,
      meaning: '学习中',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 40,
      easeFactor: 2.9,
      dueDate: '2099-01-02',
      reviewCount: 6,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'learning',
      interval: 1,
      easeFactor: 2.3,
      dueDate: '2099-01-02',
      reviewCount: 1,
    });

    const res = await request(fixture.app).get('/review/due?scope=known');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(knownWord.id);
    expect(ids).not.toContain(learningWord.id);
  });

  it('scope=today-reviewed 仅返回今日已复习单词', async () => {
    const reviewedWord = await Word.create({
      name: `reviewed_${createTestSuffix()}`,
      meaning: '今日复习',
      userId: fixture.userId,
    });
    const untouchedWord = await Word.create({
      name: `untouched_${createTestSuffix()}`,
      meaning: '未复习',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: reviewedWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: untouchedWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: reviewedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: new Date(),
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: untouchedWord.id,
      status: 'review',
      interval: 5,
      easeFactor: 2.5,
      dueDate: '2099-01-03',
      reviewCount: 3,
      lastReviewedAt: null,
    });

    const res = await request(fixture.app).get('/review/due?scope=today-reviewed');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids).toContain(reviewedWord.id);
    expect(ids).not.toContain(untouchedWord.id);
  });

  it('scope=continue 时未掌握单词排在已掌握前面', async () => {
    const knownWord = await Word.create({
      name: `continue_known_${createTestSuffix()}`,
      meaning: '已掌握',
      userId: fixture.userId,
    });
    const learningWord = await Word.create({
      name: `continue_learning_${createTestSuffix()}`,
      meaning: '学习中',
      userId: fixture.userId,
    });
    await WordRoot.create({ wordId: knownWord.id, rootId: fixture.rootId });
    await WordRoot.create({ wordId: learningWord.id, rootId: fixture.rootId });
    await WordReview.create({
      userId: fixture.userId,
      wordId: knownWord.id,
      status: 'known',
      interval: 50,
      easeFactor: 3,
      dueDate: '2099-01-04',
      reviewCount: 8,
    });
    await WordReview.create({
      userId: fixture.userId,
      wordId: learningWord.id,
      status: 'review',
      interval: 4,
      easeFactor: 2.4,
      dueDate: '2099-01-04',
      reviewCount: 2,
    });

    const res = await request(fixture.app).get('/review/due?scope=continue');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((item) => item.wordId);
    expect(ids.indexOf(learningWord.id)).toBeLessThan(ids.indexOf(knownWord.id));
  });

  it('多词根/多例句单词分页时 limit 精确命中目标条数', async () => {
    const user2 = await User.create({
      username: `due_multi_${createTestSuffix()}`,
      password: 'x',
    });
    const app2 = buildReviewApp(user2.id);

    const root1 = await Root.create({
      name: `mr1_${createTestSuffix()}`,
      meaning: '词根1',
      userId: user2.id,
    });
    const root2 = await Root.create({
      name: `mr2_${createTestSuffix()}`,
      meaning: '词根2',
      userId: user2.id,
    });
    const word1 = await Word.create({
      name: `mw1_${createTestSuffix()}`,
      meaning: '多词根单词',
      userId: user2.id,
    });
    const word2 = await Word.create({
      name: `mw2_${createTestSuffix()}`,
      meaning: '单词2',
      userId: user2.id,
    });

    await WordRoot.bulkCreate([
      { wordId: word1.id, rootId: root1.id },
      { wordId: word1.id, rootId: root2.id },
      { wordId: word2.id, rootId: root1.id },
    ]);
    await Example.bulkCreate([
      { wordId: word1.id, sentence: 'Sentence A.', translation: 'A' },
      { wordId: word1.id, sentence: 'Sentence B.', translation: 'B' },
    ]);
    await WordReview.bulkCreate([
      {
        userId: user2.id,
        wordId: word1.id,
        status: 'new',
        interval: 0,
        easeFactor: 2.5,
        dueDate: '2000-01-01',
      },
      {
        userId: user2.id,
        wordId: word2.id,
        status: 'new',
        interval: 0,
        easeFactor: 2.5,
        dueDate: '2000-01-01',
      },
    ]);

    const res1 = await request(app2).get('/review/due?scope=all&limit=1');
    const res2 = await request(app2).get('/review/due?scope=all&limit=2');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.data.length).toBe(1);
    expect(res2.body.data.length).toBe(2);
  });
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
