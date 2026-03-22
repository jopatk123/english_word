import { Router } from 'express';
import sequelize from '../../config/database.js';
import { Root, Word, WordRoot, Example } from '../../models/index.js';
import { success, error } from '../../utils/response.js';

const router = Router();

// 全量导出：所有词根、单词、例句（结构化 JSON）
router.get('/data/export', async (req, res) => {
  try {
    const roots = await Root.findAll({
      where: { userId: req.userId },
      include: [{
        model: Word,
        as: 'words',
        through: { attributes: [] },
        include: [{
          model: Example,
          as: 'examples',
          attributes: ['sentence', 'translation', 'remark'],
        }],
      }],
      order: [['create_time', 'ASC']],
    });

    // 收集所有单词（可能跨多根），避免重复
    const wordMap = new Map(); // wordId -> { name, meaning, phonetic, remark, rootNames, examples }
    const rootList = roots.map(r => ({
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
            rootNames: [],
            examples: (word.examples || []).map(e => ({
              sentence: e.sentence,
              translation: e.translation,
              remark: e.remark || null,
            })),
          });
        }
        wordMap.get(word.id).rootNames.push(root.name);
      }
    }

    const result = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      roots: rootList,
      words: Array.from(wordMap.values()),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=vocabulary-export.json');
    res.json(result);
  } catch (e) {
    error(res, e.message);
  }
});

// 全量导入：跳过重复数据，只导入新增项
router.post('/data/import', async (req, res) => {
  const data = req.body;
  if (!data || data.version !== '1.0' || !Array.isArray(data.roots) || !Array.isArray(data.words)) {
    return error(res, '导入文件格式无效，请使用本应用导出的 JSON 文件', 400);
  }

  const stats = { rootsAdded: 0, wordsAdded: 0, linksAdded: 0, examplesAdded: 0, skipped: 0 };

  await sequelize.transaction(async (t) => {
    // 步骤1：处理词根
    const rootNameToId = new Map(); // rootName -> rootId (this user's)

    // 先加载现有词根
    const existingRoots = await Root.findAll({ where: { userId: req.userId }, transaction: t });
    for (const r of existingRoots) {
      rootNameToId.set(r.name, r.id);
    }

    for (const rootData of data.roots) {
      if (!rootData.name || !rootData.meaning) continue;
      if (!rootNameToId.has(rootData.name)) {
        const newRoot = await Root.create({
          name: rootData.name,
          meaning: rootData.meaning,
          remark: rootData.remark || null,
          userId: req.userId,
          isDefault: rootData.isDefault || false,
        }, { transaction: t });
        rootNameToId.set(rootData.name, newRoot.id);
        stats.rootsAdded++;
      }
    }

    // 步骤2：处理单词
    for (const wordData of data.words) {
      if (!wordData.name || !wordData.meaning) continue;

      // 查找或创建全局单词记录
      let [word, wordCreated] = await Word.findOrCreate({
        where: { name: wordData.name },
        defaults: {
          name: wordData.name,
          meaning: wordData.meaning,
          phonetic: wordData.phonetic || null,
          remark: wordData.remark || null,
        },
        transaction: t,
      });
      if (wordCreated) stats.wordsAdded++;

      // 步骤3：建立单词与该用户词根的关联
      const targetRootNames = (wordData.rootNames || []).filter(n => rootNameToId.has(n));
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
        const existingSentences = new Set(existingExamples.map(e => e.sentence.trim()));

        for (const exData of wordData.examples) {
          if (!exData.sentence || !exData.translation) continue;
          if (existingSentences.has(exData.sentence.trim())) continue;
          await Example.create({
            wordId: word.id,
            sentence: exData.sentence,
            translation: exData.translation,
            remark: exData.remark || null,
          }, { transaction: t });
          existingSentences.add(exData.sentence.trim());
          stats.examplesAdded++;
        }
      }
    }
  });

  success(res, stats, `导入完成：新增词根 ${stats.rootsAdded} 个，单词 ${stats.wordsAdded} 个，例句 ${stats.examplesAdded} 条`);
});

export default router;
