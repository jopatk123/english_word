import { Router } from 'express';
import { Root, Word, Example } from '../models/index.js';
import {
  requestAiJson,
  sanitizeExampleSuggestions,
  sanitizeRootSuggestions,
  sanitizeWordSuggestions,
  validateAiConfig,
} from '../utils/ai.js';
import { createDebugInfo, logAiError, logAiInfo, withDuration } from '../utils/aiDebug.js';
import {
  buildAnalyzeSentencePrompt,
  buildAnalyzeWordPrompt,
  buildExamplePrompt,
  buildRootPrompt,
  buildWordPrompt,
  sanitizeAnalyzeSentenceResult,
  sanitizeAnalyzeWordResult,
} from '../utils/aiPrompts.js';
import { success, error } from '../utils/response.js';

const router = Router();

// ── 工具函数 ──────────────────────────────────────────────────

/**
 * 统一处理路由异常，避免各路由重复相同的 catch 逻辑。
 */
const handleAiError = (res, req, startedAt, route, e, extra = {}) => {
  const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
  logAiError(`${route}.error`, debugInfo, e, extra);
  error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
};

/**
 * 处理 AI 建议型接口的公共结果统计逻辑。
 * @param {unknown} payload - AI 返回的原始 JSON
 * @param {Function} sanitize - 对应的净化函数
 * @param {string[]} existingNames - 已有条目名称列表（去重用）
 */
const processSuggestionResult = (payload, sanitize, existingNames) => {
  const rawCount = Array.isArray(payload?.items) ? payload.items.length : 0;
  const items = sanitize(payload?.items, existingNames);
  return {
    rawCount,
    items,
    hasMore: Boolean(payload?.hasMore) && items.length > 0,
    filteredCount: rawCount - items.length,
  };
};

const normalizeSentenceList = (value, maxLength = 400, maxCount = 20) => {
  const list = Array.isArray(value) ? value : [];
  const unique = new Set();
  const result = [];

  for (const item of list) {
    const sentence = `${item || ''}`.trim().slice(0, maxLength);
    if (!sentence) continue;

    const normalized = sentence.toLowerCase();
    if (unique.has(normalized)) continue;

    unique.add(normalized);
    result.push(sentence);
    if (result.length >= maxCount) break;
  }

  return result;
};

// ── 连通性测试 ────────────────────────────────────────────────

router.post('/test', async (req, res) => {
  const startedAt = Date.now();
  try {
    const config = validateAiConfig(req.body?.config || {});
    const debugInfo = createDebugInfo(req, config, startedAt);
    logAiInfo('test.start', debugInfo);

    const payload = await requestAiJson(config, {
      systemPrompt: '你是一个 API 连通性测试助手。你只能返回 JSON。',
      userPrompt:
        '请只返回 JSON：{"message":"ok","hasMore":false,"items":[]}。不要输出任何其他内容。',
    });

    logAiInfo('test.success', debugInfo, { ok: true });
    success(
      res,
      {
        ok: payload?.message === 'ok' || Array.isArray(payload?.items),
        debug: withDuration(debugInfo),
      },
      '连接测试成功'
    );
  } catch (e) {
    handleAiError(res, req, startedAt, 'test', e);
  }
});

// ── 推荐词根 ──────────────────────────────────────────────────

router.post('/suggest-roots', async (req, res) => {
  const startedAt = Date.now();
  try {
    const validatedConfig = validateAiConfig(req.body?.config || {});
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-roots.start', debugInfo);

    const roots = await Root.findAll({ where: { userId: req.userId }, order: [['name', 'ASC']] });
    const payload = await requestAiJson(validatedConfig, buildRootPrompt(roots));
    const { rawCount, items, hasMore, filteredCount } = processSuggestionResult(
      payload,
      sanitizeRootSuggestions,
      roots.map((r) => r.name)
    );
    const message = items.length
      ? `本次生成了 ${rawCount} 个词根候选，过滤重复或无效项后保留 ${items.length} 个可添加词根。`
      : '当前词根库暂时没有明显值得补充的常用词根了';

    logAiInfo('suggest-roots.success', debugInfo, {
      existingRootCount: roots.length,
      rawSuggestedCount: rawCount,
      suggestedCount: items.length,
      filteredCount,
      hasMore,
    });

    success(res, { items, hasMore, message, debug: withDuration(debugInfo) });
  } catch (e) {
    handleAiError(res, req, startedAt, 'suggest-roots', e);
  }
});

// ── 推荐单词 ──────────────────────────────────────────────────

router.post('/suggest-words', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { rootId, config = {}, excludedWords = [] } = req.body || {};
    if (!rootId) return error(res, '缺少词根 ID', 400);

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-words.start', debugInfo, { rootId });

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await root.getWords({ order: [['name', 'ASC']] });
    const normalizedExcludedWords = Array.isArray(excludedWords)
      ? excludedWords
          .filter((w) => w && typeof w === 'string')
          .map((w) => w.trim().toLowerCase())
          .slice(0, 50)
      : [];

    const payload = await requestAiJson(
      validatedConfig,
      buildWordPrompt(root, words, normalizedExcludedWords)
    );
    const { rawCount, items, hasMore, filteredCount } = processSuggestionResult(
      payload,
      sanitizeWordSuggestions,
      [...words.map((w) => w.name), ...normalizedExcludedWords]
    );
    const message = items.length
      ? `本次生成了 ${rawCount} 个单词候选，过滤重复或无效项后保留 ${items.length} 个可添加单词。`
      : `词根「${root.name}」下暂时没有更适合继续补充的常用单词了`;

    logAiInfo('suggest-words.success', debugInfo, {
      rootId,
      rootName: root.name,
      existingWordCount: words.length,
      excludedWordCount: normalizedExcludedWords.length,
      rawSuggestedCount: rawCount,
      suggestedCount: items.length,
      filteredCount,
      hasMore,
    });

    success(res, {
      root: { id: root.id, name: root.name, meaning: root.meaning },
      items,
      hasMore,
      message,
      debug: withDuration(debugInfo),
    });
  } catch (e) {
    handleAiError(res, req, startedAt, 'suggest-words', e, { rootId: req.body?.rootId });
  }
});

// ── 推荐例句 ──────────────────────────────────────────────────

router.post('/suggest-examples', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { wordId, config = {}, excludedSentences = [] } = req.body || {};
    if (!wordId) return error(res, '缺少单词 ID', 400);

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-examples.start', debugInfo, { wordId });

    const word = await Word.findByPk(wordId, {
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          attributes: ['id', 'name', 'meaning', 'userId'],
        },
      ],
    });
    if (!word || !word.roots?.some((r) => r.userId === req.userId))
      return error(res, '单词不存在', 404);

    const examples = await Example.findAll({ where: { wordId }, order: [['create_time', 'ASC']] });
    const normalizedExcludedSentences = normalizeSentenceList(excludedSentences);
    const payload = await requestAiJson(
      validatedConfig,
      buildExamplePrompt(word, examples, normalizedExcludedSentences)
    );
    const { rawCount, items, hasMore, filteredCount } = processSuggestionResult(
      payload,
      sanitizeExampleSuggestions,
      [...examples.map((e) => e.sentence), ...normalizedExcludedSentences]
    );
    const message = items.length
      ? `本次生成了 ${rawCount} 条例句候选，过滤重复或无效项后保留 ${items.length} 条可添加例句。`
      : `单词「${word.name}」下暂时没有更适合继续补充的常用例句了`;

    logAiInfo('suggest-examples.success', debugInfo, {
      wordId,
      wordName: word.name,
      existingExampleCount: examples.length,
      excludedExampleCount: normalizedExcludedSentences.length,
      rawSuggestedCount: rawCount,
      suggestedCount: items.length,
      filteredCount,
      hasMore,
    });

    success(res, {
      word: { id: word.id, name: word.name, meaning: word.meaning, phonetic: word.phonetic },
      items,
      hasMore,
      message,
      debug: withDuration(debugInfo),
    });
  } catch (e) {
    handleAiError(res, req, startedAt, 'suggest-examples', e, { wordId: req.body?.wordId });
  }
});

// ── 搜索分析：单词 ────────────────────────────────────────────

router.post('/analyze-word', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { word, config = {}, excludedSentences = [], singleExample = false } = req.body || {};
    if (!word || typeof word !== 'string' || !/^[a-zA-Z-]+$/.test(word.trim())) {
      return error(res, '请输入合法的英文单词（仅支持字母和连字符）', 400);
    }
    const trimmedWord = word.trim().toLowerCase();

    // 单词若已收录（且关联词根属于当前用户），直接返回缓存数据，不消耗 AI 配额
    const existingWord = await Word.findOne({
      where: { name: trimmedWord },
      include: [
        {
          model: Root,
          as: 'roots',
          through: { attributes: [] },
          attributes: ['id', 'name', 'meaning', 'userId'],
          where: { userId: req.userId },
          required: true,
        },
      ],
    });

    if (existingWord) {
      const existingRoots = existingWord.roots.map((r) => ({
        id: r.id,
        name: r.name,
        meaning: r.meaning,
      }));
      return success(res, {
        analysis: {
          word: existingWord.name,
          meaning: existingWord.meaning,
          phonetic: existingWord.phonetic || '',
          partOfSpeech: [],
          roots: existingWord.roots.map((r) => ({ name: r.name, meaning: r.meaning })),
          examples: [],
        },
        existingWord: {
          id: existingWord.id,
          name: existingWord.name,
          meaning: existingWord.meaning,
          roots: existingRoots,
        },
        existingRoots,
        debug: withDuration(createDebugInfo(req, config || {}, startedAt)),
      });
    }

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    const normalizedExcludedSentences = normalizeSentenceList(excludedSentences);
    const shouldGenerateSingleExample = Boolean(singleExample);
    logAiInfo('analyze-word.start', debugInfo, {
      word: trimmedWord,
      excludedExampleCount: normalizedExcludedSentences.length,
      singleExample: shouldGenerateSingleExample,
    });

    const payload = await requestAiJson(
      validatedConfig,
      buildAnalyzeWordPrompt(trimmedWord, {
        excludedSentences: normalizedExcludedSentences,
        singleExample: shouldGenerateSingleExample,
      })
    );
    const analysis = sanitizeAnalyzeWordResult(payload, trimmedWord);
    if (!analysis) return error(res, 'AI 返回的分析结果无效，请重试', 400);

    if (normalizedExcludedSentences.length && Array.isArray(analysis.examples)) {
      const excludedSet = new Set(
        normalizedExcludedSentences.map((sentence) => sentence.toLowerCase())
      );
      analysis.examples = analysis.examples.filter(
        (item) => !excludedSet.has(item.sentence.toLowerCase())
      );
    }

    if (shouldGenerateSingleExample) {
      analysis.examples = analysis.examples.slice(0, 1);
    }

    // 检查分析出的词根是否已存在于用户词根库
    const existingRoots = [];
    for (const root of analysis.roots) {
      const found = await Root.findOne({ where: { name: root.name, userId: req.userId } });
      if (found) existingRoots.push({ id: found.id, name: found.name, meaning: found.meaning });
    }

    logAiInfo('analyze-word.success', debugInfo, {
      word: trimmedWord,
      wordExists: false,
      rootCount: analysis.roots.length,
      existingRootCount: existingRoots.length,
      exampleCount: analysis.examples.length,
      singleExample: shouldGenerateSingleExample,
    });

    success(res, { analysis, existingWord: null, existingRoots, debug: withDuration(debugInfo) });
  } catch (e) {
    handleAiError(res, req, startedAt, 'analyze-word', e);
  }
});

// ── 搜索分析：句子 ────────────────────────────────────────────

router.post('/analyze-sentence', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { sentence, config = {} } = req.body || {};
    if (!sentence || typeof sentence !== 'string' || sentence.trim().length < 2) {
      return error(res, '请输入合法的英文句子', 400);
    }
    const trimmedSentence = sentence.trim().slice(0, 500);

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('analyze-sentence.start', debugInfo, { sentenceLength: trimmedSentence.length });

    const payload = await requestAiJson(
      validatedConfig,
      buildAnalyzeSentencePrompt(trimmedSentence)
    );
    const analysis = sanitizeAnalyzeSentenceResult(payload, trimmedSentence);
    if (!analysis) return error(res, 'AI 返回的分析结果无效，请重试', 400);

    logAiInfo('analyze-sentence.success', debugInfo, {
      sentenceLength: trimmedSentence.length,
      vocabularyCount: analysis.vocabulary.length,
    });

    success(res, { analysis, debug: withDuration(debugInfo) });
  } catch (e) {
    handleAiError(res, req, startedAt, 'analyze-sentence', e);
  }
});

export default router;
