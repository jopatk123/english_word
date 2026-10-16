import { Router } from 'express';
import sequelize from '../../config/database.js';
import {
  Root,
  Word,
  WordRoot,
  Example,
  WordReview,
  Passage,
  PassageSentence,
} from '../../models/index.js';
import { success, error, handleRouteError } from '../../utils/response.js';
import { ensureWordReview } from '../../utils/wordReview.js';
import { ensureDefaultRoot } from '../../utils/defaultRoot.js';
import { createPassage } from '../../services/passage-store.js';
import { splitPassage } from '../../services/passage-splitter.js';

const router = Router();

const normalizeRootName = (name) => `${name || ''}`.trim().toLowerCase();

const VALID_REVIEW_STATUSES = new Set(['new', 'learning', 'review', 'known']);

/**
 * 为新导入的单词恢复复习进度。
 * 若导出数据包含有效的 status 和 dueDate，则还原完整进度；否则使用默认初始状态。
 */
async function restoreOrInitWordReview(userId, wordId, wordData, transaction) {
  const status =
    typeof wordData?.status === 'string' && VALID_REVIEW_STATUSES.has(wordData.status)
      ? wordData.status
      : null;

  if (status && wordData.dueDate) {
    return WordReview.findOrCreate({
      where: { userId, wordId },
      defaults: {
        userId,
        wordId,
        status,
        interval: Math.max(0, parseInt(wordData.interval, 10) || 0),
        easeFactor: Math.max(1.3, parseFloat(wordData.easeFactor) || 2.5),
        dueDate: wordData.dueDate,
        dueAt: wordData.dueAt || null,
        reviewCount: Math.max(0, parseInt(wordData.reviewCount, 10) || 0),
        successCount: Math.max(0, parseInt(wordData.successCount, 10) || 0),
        perfectStreakCount: Math.max(0, parseInt(wordData.perfectStreakCount, 10) || 0),
      },
      transaction,
    });
  }

  return ensureWordReview(userId, wordId, { transaction });
}

// 全量导出：所有词根、单词、例句（结构化 JSON）
router.get('/data/export', async (req, res) => {
  try {
    const roots = await Root.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: Word,
          as: 'words',
          through: { attributes: [] },
          where: { userId: req.userId },
          required: false,
          include: [
            {
              model: Example,
              as: 'examples',
              attributes: ['sentence', 'translation', 'remark'],
            },
            {
              model: WordReview,
              as: 'reviews',
              where: { userId: req.userId },
              required: false,
              attributes: [
                'status',
                'interval',
                'easeFactor',
                'dueDate',
                'dueAt',
                'reviewCount',
                'successCount',
                'perfectStreakCount',
              ],
            },
          ],
        },
      ],
      order: [['create_time', 'ASC']],
    });

    // 收集所有单词（可能跨多根），避免重复
    const wordMap = new Map(); // wordId -> { name, meaning, phonetic, remark, rootNames, examples }
    const rootList = roots.map((r) => ({
      name: r.name,
      meaning: r.meaning,
      remark: r.remark || null,
      isDefault: r.isDefault,
    }));

    for (const root of roots) {
      for (const word of root.words || []) {
        if (!wordMap.has(word.id)) {
          wordMap.set(word.id, {
            name: word.name,
            meaning: word.meaning,
            phonetic: word.phonetic || null,
            remark: word.remark || null,
            status: word.reviews?.[0]?.status || 'new',
            interval: word.reviews?.[0]?.interval ?? 0,
            easeFactor: word.reviews?.[0]?.easeFactor ?? 2.5,
            dueDate: word.reviews?.[0]?.dueDate || null,
            dueAt: word.reviews?.[0]?.dueAt || null,
            reviewCount: word.reviews?.[0]?.reviewCount ?? 0,
            successCount: word.reviews?.[0]?.successCount ?? 0,
            perfectStreakCount: word.reviews?.[0]?.perfectStreakCount ?? 0,
            rootNames: [],
            examples: (word.examples || []).map((e) => ({
              sentence: e.sentence,
              translation: e.translation,
              remark: e.remark || null,
            })),
          });
        }
        wordMap.get(word.id).rootNames.push(root.name);
      }
    }

    const passages = await Passage.findAll({
      where: { userId: req.userId },
      include: [{ model: PassageSentence, as: 'sentences' }],
      order: [['create_time', 'ASC']],
    });

    const result = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      roots: rootList,
      words: Array.from(wordMap.values()),
      // 不含重读进度，导入后按新短文重新开始
      passages: passages.map((passage) => ({
        title: passage.title,
        content: passage.content,
        level: passage.level,
        source: passage.source,
        topic: passage.topic,
        sentences: [...(passage.sentences || [])]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((sentence) => ({
            text: sentence.text,
            translation: sentence.translation,
          })),
      })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=vocabulary-export.json');
    res.json(result);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// 全量导入：跳过重复数据，只导入新增项
router.post('/data/import', async (req, res) => {
  const data = req.body;
  if (
    !data ||
    !['1.0', '2.0'].includes(data.version) ||
    !Array.isArray(data.roots) ||
    !Array.isArray(data.words) ||
    (data.passages !== undefined && !Array.isArray(data.passages))
  ) {
    return error(res, '导入文件格式无效，请使用本应用导出的 JSON 文件', 400);
  }

  const stats = {
    rootsAdded: 0,
    wordsAdded: 0,
    linksAdded: 0,
    examplesAdded: 0,
    passagesAdded: 0,
    skipped: 0,
  };

  await sequelize.transaction(async (t) => {
    // 步骤1：处理词根
    const rootNameToId = new Map(); // rootName -> rootId (this user's)

    // 先加载现有词根
    const existingRoots = await Root.findAll({ where: { userId: req.userId }, transaction: t });
    for (const r of existingRoots) {
      rootNameToId.set(normalizeRootName(r.name), r.id);
    }

    // 找到已有的默认词根（每用户只有一条）
    const existingDefaultRoot = existingRoots.find((r) => r.isDefault) || null;

    for (const rootData of data.roots) {
      if (!rootData.name || !rootData.meaning) continue;
      const normalizedRootName = normalizeRootName(rootData.name);
      if (!normalizedRootName) continue;

      // 名称已存在，跳过创建
      if (rootNameToId.has(normalizedRootName)) continue;

      // 导入数据携带 isDefault=true 时，绝不创建第二条默认词根；
      // 将该名称映射到用户已有的默认词根；若不存在则补创建。
      if (rootData.isDefault) {
        if (existingDefaultRoot) {
          rootNameToId.set(normalizedRootName, existingDefaultRoot.id);
        } else {
          const defaultRoot = await ensureDefaultRoot(req.userId, { transaction: t });
          rootNameToId.set(normalizedRootName, defaultRoot.id);
          stats.rootsAdded++;
        }
        continue;
      }

      const newRoot = await Root.create(
        {
          name: rootData.name.trim(),
          meaning: rootData.meaning.trim(),
          remark: rootData.remark || null,
          userId: req.userId,
          isDefault: false, // 导入时强制为 false，避免意外创建第二默认词根
        },
        { transaction: t }
      );
      rootNameToId.set(normalizedRootName, newRoot.id);
      stats.rootsAdded++;
    }

    // 步骤2：处理单词
    for (const wordData of data.words) {
      if (!wordData.name || !wordData.meaning) continue;

      const normalizedWordName = wordData.name.trim().toLowerCase();
      const normalizedMeaning = wordData.meaning.trim();
      if (!normalizedWordName || !normalizedMeaning) continue;

      // 为当前用户查找或创建单词，避免不同用户共享同一条单词记录。
      let [word, wordCreated] = await Word.findOrCreate({
        where: { name: normalizedWordName, userId: req.userId },
        defaults: {
          name: normalizedWordName,
          meaning: normalizedMeaning,
          phonetic: wordData.phonetic?.trim() || null,
          remark: wordData.remark?.trim() || null,
          userId: req.userId,
        },
        transaction: t,
      });
      if (wordCreated) {
        stats.wordsAdded++;
        await restoreOrInitWordReview(req.userId, word.id, wordData, t);
      } else {
        await ensureWordReview(req.userId, word.id, { transaction: t });
      }

      // 步骤3：建立单词与该用户词根的关联
      const targetRootNames = (wordData.rootNames || [])
        .map((name) => normalizeRootName(name))
        .filter((name) => rootNameToId.has(name));
      for (const rootName of targetRootNames) {
        const rootId = rootNameToId.get(rootName);
        const [, linkCreated] = await WordRoot.findOrCreate({
          where: { wordId: word.id, rootId },
          transaction: t,
        });
        if (linkCreated) stats.linksAdded++;
        else stats.skipped++;
      }

      // 步骤4：处理例句（仅新增，跳过已存在的句子）
      if (Array.isArray(wordData.examples) && wordData.examples.length > 0) {
        const existingExamples = await Example.findAll({
          where: { wordId: word.id },
          attributes: ['sentence'],
          transaction: t,
        });
        const existingSentences = new Set(existingExamples.map((e) => e.sentence.trim()));

        for (const exData of wordData.examples) {
          if (!exData.sentence || !exData.translation) continue;
          const sentence = exData.sentence.trim();
          const translation = exData.translation.trim();
          if (!sentence || !translation || existingSentences.has(sentence)) continue;
          await Example.create(
            {
              wordId: word.id,
              sentence,
              translation,
              remark: exData.remark?.trim() || null,
            },
            { transaction: t }
          );
          existingSentences.add(sentence);
          stats.examplesAdded++;
        }
      }
    }
  });

  // 短文在词库事务提交后单独导入：一篇失败不影响词库，标题加规范化正文相同则跳过。
  for (const passageData of data.passages || []) {
    if (typeof passageData?.title !== 'string' || typeof passageData?.content !== 'string') {
      stats.skipped++;
      continue;
    }
    try {
      const normalized = splitPassage(passageData.content).content;
      const existing = await Passage.findOne({
        where: { userId: req.userId, title: passageData.title.trim(), content: normalized },
      });
      if (existing) {
        stats.skipped++;
        continue;
      }
      await createPassage(req.userId, {
        title: passageData.title,
        content: passageData.content,
        level: passageData.level || null,
        source: passageData.source === 'ai' ? 'ai' : 'manual',
        topic: passageData.topic || null,
        sentenceTranslations: Array.isArray(passageData.sentences) ? passageData.sentences : null,
      });
      stats.passagesAdded++;
    } catch {
      stats.skipped++;
    }
  }

  const passagePart = stats.passagesAdded ? `，短文 ${stats.passagesAdded} 篇` : '';
  success(
    res,
    stats,
    `导入完成：新增词根 ${stats.rootsAdded} 个，单词 ${stats.wordsAdded} 个，例句 ${stats.examplesAdded} 条${passagePart}`
  );
});

export default router;
