import { Router } from 'express';
import { Root, Word, Example } from '../models/index.js';
import { requestAiJson, sanitizeExampleSuggestions, sanitizeRootSuggestions, sanitizeWordSuggestions, validateAiConfig } from '../utils/ai.js';
import { success, error } from '../utils/response.js';

const router = Router();

const maskApiKey = (apiKey = '') => {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

const createDebugInfo = (req, config, startedAt) => ({
  requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  providerId: config?.providerId || '',
  providerType: config?.providerType || '',
  baseUrl: config?.baseUrl || '',
  model: config?.model || '',
  apiKeyMasked: maskApiKey(config?.apiKey),
  method: req.method,
  path: req.originalUrl,
  startedAt,
});

const withDuration = (debugInfo) => ({
  ...debugInfo,
  durationMs: Date.now() - debugInfo.startedAt,
});

const logAiInfo = (message, debugInfo, extra = {}) => {
  console.log(`[AI] ${message}`, JSON.stringify({ ...withDuration(debugInfo), ...extra }));
};

const logAiError = (message, debugInfo, err, extra = {}) => {
  console.error(`[AI] ${message}`, JSON.stringify({
    ...withDuration(debugInfo),
    error: err?.message || 'unknown error',
    ...extra,
  }));
};

const buildRootPrompt = (roots) => {
  const existingRoots = roots.length
    ? roots.map((root) => `${root.name}: ${root.meaning}`).join('\n')
    : '当前还没有任何词根。';
  const existingRootNames = roots.length
    ? roots.map((root) => root.name).join(', ')
    : '无';

  return {
    systemPrompt: `你是专业英语词根助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
    userPrompt: `基于现有词根库，推荐最多3个**未收录**的常用英语词根。

规则（必须严格遵守）：
1. 只推荐一般常用、构词能力强的拉丁/希腊词根。
2. **绝对不能推荐以下已存在词根**：${existingRootNames}
3. 不能推荐近似重复词根。
4. 若无更多可推荐，返回空数组，hasMore: false。
5. **禁止返回 remark 字段**。
6. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "name": "fer",
      "meaning": "带来；携带",
      "reason": "构词能力强，适合记忆"
    }
  ]
}

已有词根：
${existingRoots}`,
  };
};

const buildWordPrompt = (root, words) => {
  const existingWords = words.length
    ? words.map((word) => `${word.name}: ${word.meaning}`).join('\n')
    : '当前该词根下还没有任何单词。';
  const existingWordNames = words.length
    ? words.map((word) => word.name).join(', ')
    : '无';

  return {
    systemPrompt: `你是专业英语单词助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
    userPrompt: `围绕词根【${root.name}（${root.meaning}）】推荐最多3个**未收录**的常用单词。

规则（必须严格遵守）：
1. 必须属于该词根，日常常用、适合学习。
2. **绝对不能推荐以下已存在单词**：${existingWordNames}
3. 若无更多可推荐，返回空数组，hasMore: false。
4. **禁止返回 remark 字段**。
5. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "name": "inspect",
      "meaning": "检查；视察",
      "phonetic": "/ɪnˈspekt/",
      "reason": "由 in + spect 构成"
    }
  ]
}

已有单词：
${existingWords}`,
  };
};

const buildExamplePrompt = (word, examples) => {
  const existingExamples = examples.length
    ? examples.map((example) => `- ${example.sentence}`).join('\n')
    : '当前该单词下还没有任何例句。';

  return {
    systemPrompt: `你是专业英语例句助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
    userPrompt: `为单词【${word.name}】生成最多3条**全新、不重复**的高质量英文例句+中文翻译。

单词信息：
- 单词：${word.name}
- 含义：${word.meaning}
- 音标：${word.phonetic || '无'}
- 词根：${word.root?.name || '无'}

规则（必须严格遵守）：
1. 句子中的单词常用、自然、不生硬，且能体现该单词的典型用法和语境。
2. **绝对不能与以下例句相同或高度相似**：
${existingExamples}
3. 若无更多可推荐，返回空数组，hasMore: false。
4. **禁止返回 remark 字段**。
5. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "sentence": "She inspected the room carefully.",
      "translation": "她仔细检查了房间。",
      "reason": "体现 inspect 常见用法"
    }
  ]
}

已有例句（必须避开）：
${existingExamples}`,
  };
};

router.post('/test', async (req, res) => {
  const startedAt = Date.now();
  try {
    const config = validateAiConfig(req.body?.config || {});
    const debugInfo = createDebugInfo(req, config, startedAt);
    logAiInfo('test.start', debugInfo);
    const payload = await requestAiJson(config, {
      systemPrompt: '你是一个 API 连通性测试助手。你只能返回 JSON。',
      userPrompt: '请只返回 JSON：{"message":"ok","hasMore":false,"items":[]}。不要输出任何其他内容。',
    });
    logAiInfo('test.success', debugInfo, { ok: true });
    success(res, { ok: payload?.message === 'ok' || Array.isArray(payload?.items), debug: withDuration(debugInfo) }, '连接测试成功');
  } catch (e) {
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('test.error', debugInfo, e);
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

router.post('/suggest-roots', async (req, res) => {
  const startedAt = Date.now();
  try {
    const config = req.body?.config || {};
    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-roots.start', debugInfo);
    const roots = await Root.findAll({ where: { userId: req.userId }, order: [['name', 'ASC']] });
    const payload = await requestAiJson(validatedConfig, buildRootPrompt(roots));
    const rawCount = Array.isArray(payload?.items) ? payload.items.length : 0;
    const items = sanitizeRootSuggestions(payload?.items, roots.map((item) => item.name));
    const hasMore = Boolean(payload?.hasMore) && items.length > 0;
    const filteredCount = rawCount - items.length;
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
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('suggest-roots.error', debugInfo, e);
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

router.post('/suggest-words', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { rootId, config = {} } = req.body || {};
    if (!rootId) return error(res, '缺少词根 ID', 400);

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-words.start', debugInfo, { rootId });

    const root = await Root.findByPk(rootId);
    if (!root || root.userId !== req.userId) return error(res, '词根不存在', 404);

    const words = await Word.findAll({
      where: { rootId },
      order: [['name', 'ASC']],
    });

    const payload = await requestAiJson(validatedConfig, buildWordPrompt(root, words));
    const rawCount = Array.isArray(payload?.items) ? payload.items.length : 0;
    const items = sanitizeWordSuggestions(payload?.items, words.map((item) => item.name));
    const hasMore = Boolean(payload?.hasMore) && items.length > 0;
    const filteredCount = rawCount - items.length;
    const message = items.length
      ? `本次生成了 ${rawCount} 个单词候选，过滤重复或无效项后保留 ${items.length} 个可添加单词。`
      : `词根「${root.name}」下暂时没有更适合继续补充的常用单词了`;

    logAiInfo('suggest-words.success', debugInfo, {
      rootId,
      rootName: root.name,
      existingWordCount: words.length,
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
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('suggest-words.error', debugInfo, e, { rootId: req.body?.rootId });
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

router.post('/suggest-examples', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { wordId, config = {} } = req.body || {};
    if (!wordId) return error(res, '缺少单词 ID', 400);

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('suggest-examples.start', debugInfo, { wordId });

    const word = await Word.findByPk(wordId, {
      include: [{ model: Root, as: 'root', attributes: ['id', 'name', 'meaning', 'userId'] }],
    });
    if (!word || word.root?.userId !== req.userId) return error(res, '单词不存在', 404);

    const examples = await Example.findAll({
      where: { wordId },
      order: [['create_time', 'ASC']],
    });

    const payload = await requestAiJson(validatedConfig, buildExamplePrompt(word, examples));
    const rawCount = Array.isArray(payload?.items) ? payload.items.length : 0;
    const items = sanitizeExampleSuggestions(payload?.items, examples.map((item) => item.sentence));
    const hasMore = Boolean(payload?.hasMore) && items.length > 0;
    const filteredCount = rawCount - items.length;
    const message = items.length
      ? `本次生成了 ${rawCount} 条例句候选，过滤重复或无效项后保留 ${items.length} 条可添加例句。`
      : `单词「${word.name}」下暂时没有更适合继续补充的常用例句了`;

    logAiInfo('suggest-examples.success', debugInfo, {
      wordId,
      wordName: word.name,
      existingExampleCount: examples.length,
      rawSuggestedCount: rawCount,
      suggestedCount: items.length,
      filteredCount,
      hasMore,
    });

    success(res, {
      word: {
        id: word.id,
        name: word.name,
        meaning: word.meaning,
        phonetic: word.phonetic,
      },
      items,
      hasMore,
      message,
      debug: withDuration(debugInfo),
    });
  } catch (e) {
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('suggest-examples.error', debugInfo, e, { wordId: req.body?.wordId });
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

// ========== 搜索分析：单词 ==========
const buildAnalyzeWordPrompt = (word) => ({
  systemPrompt: `你是专业英语词根助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
  userPrompt: `分析英语单词【${word}】，返回其含义、音标、词根信息和1-3条常用例句。

规则（必须严格遵守）：
1. 返回该单词最常用的中文含义和音标。
2. 如果该单词有词根，返回词根名称和词根含义；如果没有明确词根，root 字段设为 null。
3. 生成1-3条高质量英文例句+中文翻译。
4. 只返回标准JSON，格式如下：
{
  "word": "${word}",
  "meaning": "中文含义",
  "phonetic": "/音标/",
  "root": {
    "name": "词根名",
    "meaning": "词根含义"
  },
  "examples": [
    {
      "sentence": "英文例句",
      "translation": "中文翻译"
    }
  ]
}

如果没有词根，root 为 null：
{
  "word": "${word}",
  "meaning": "中文含义",
  "phonetic": "/音标/",
  "root": null,
  "examples": [...]
}`,
});

const sanitizeAnalyzeWordResult = (parsed, word) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const result = {
    word: (parsed.word || word).trim().toLowerCase().slice(0, 60),
    meaning: (parsed.meaning || '').trim().slice(0, 200),
    phonetic: (parsed.phonetic || '').trim().slice(0, 80),
    root: null,
    examples: [],
  };

  if (parsed.root && typeof parsed.root === 'object' && parsed.root.name) {
    const rootName = parsed.root.name.trim().toLowerCase().slice(0, 40);
    const rootMeaning = (parsed.root.meaning || '').trim().slice(0, 80);
    if (/^[a-z-]{2,40}$/.test(rootName) && rootMeaning) {
      result.root = { name: rootName, meaning: rootMeaning };
    }
  }

  const items = Array.isArray(parsed.examples) ? parsed.examples : [];
  for (const item of items) {
    const sentence = (item?.sentence || '').trim().slice(0, 400);
    const translation = (item?.translation || '').trim().slice(0, 240);
    if (sentence && translation && sentence.length >= 5) {
      result.examples.push({ sentence, translation });
      if (result.examples.length >= 3) break;
    }
  }

  return result.meaning ? result : null;
};

router.post('/analyze-word', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { word, config = {} } = req.body || {};
    if (!word || typeof word !== 'string' || !/^[a-zA-Z-]+$/.test(word.trim())) {
      return error(res, '请输入合法的英文单词（仅支持字母和连字符）', 400);
    }
    const trimmedWord = word.trim().toLowerCase();

    const validatedConfig = validateAiConfig(config);
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('analyze-word.start', debugInfo, { word: trimmedWord });

    // 检查单词是否已存在
    const existingWord = await Word.findOne({
      where: { name: trimmedWord },
      include: [
        { model: Root, as: 'root', attributes: ['id', 'name', 'meaning', 'userId'], where: { userId: req.userId }, required: true },
      ],
    });

    // 调用 AI 分析
    const payload = await requestAiJson(validatedConfig, buildAnalyzeWordPrompt(trimmedWord));
    const analysis = sanitizeAnalyzeWordResult(payload, trimmedWord);
    if (!analysis) {
      return error(res, 'AI 返回的分析结果无效，请重试', 400);
    }

    // 检查词根是否已存在
    let existingRoot = null;
    if (analysis.root) {
      existingRoot = await Root.findOne({
        where: { name: analysis.root.name, userId: req.userId },
      });
    }

    logAiInfo('analyze-word.success', debugInfo, {
      word: trimmedWord,
      wordExists: !!existingWord,
      rootExists: !!existingRoot,
      rootName: analysis.root?.name,
      exampleCount: analysis.examples.length,
    });

    success(res, {
      analysis,
      existingWord: existingWord ? {
        id: existingWord.id,
        name: existingWord.name,
        meaning: existingWord.meaning,
        rootId: existingWord.root?.id,
        rootName: existingWord.root?.name,
      } : null,
      existingRoot: existingRoot ? {
        id: existingRoot.id,
        name: existingRoot.name,
        meaning: existingRoot.meaning,
      } : null,
      debug: withDuration(debugInfo),
    });
  } catch (e) {
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('analyze-word.error', debugInfo, e);
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

// ========== 搜索分析：句子 ==========
const buildAnalyzeSentencePrompt = (sentence) => ({
  systemPrompt: `你是专业英语教学助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
  userPrompt: `分析以下英文句子，帮助用户学习理解：

句子：${sentence}

规则（必须严格遵守）：
1. 提供中文翻译
2. 分析句子的语法结构
3. 列出1-5个关键词汇及其含义
4. 只返回标准JSON，格式如下：
{
  "sentence": "原句",
  "translation": "中文翻译",
  "grammar": "语法结构分析（中文说明）",
  "vocabulary": [
    {
      "word": "单词",
      "meaning": "中文含义",
      "phonetic": "/音标/"
    }
  ]
}`,
});

const sanitizeAnalyzeSentenceResult = (parsed, sentence) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const result = {
    sentence: (parsed.sentence || sentence).trim().slice(0, 500),
    translation: (parsed.translation || '').trim().slice(0, 500),
    grammar: (parsed.grammar || '').trim().slice(0, 1000),
    vocabulary: [],
  };

  const items = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
  for (const item of items) {
    const w = (item?.word || '').trim().slice(0, 60);
    const m = (item?.meaning || '').trim().slice(0, 120);
    const p = (item?.phonetic || '').trim().slice(0, 80);
    if (w && m) {
      result.vocabulary.push({ word: w, meaning: m, phonetic: p });
      if (result.vocabulary.length >= 8) break;
    }
  }

  return result.translation ? result : null;
};

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

    const payload = await requestAiJson(validatedConfig, buildAnalyzeSentencePrompt(trimmedSentence));
    const analysis = sanitizeAnalyzeSentenceResult(payload, trimmedSentence);
    if (!analysis) {
      return error(res, 'AI 返回的分析结果无效，请重试', 400);
    }

    logAiInfo('analyze-sentence.success', debugInfo, {
      sentenceLength: trimmedSentence.length,
      vocabularyCount: analysis.vocabulary.length,
    });

    success(res, {
      analysis,
      debug: withDuration(debugInfo),
    });
  } catch (e) {
    const debugInfo = createDebugInfo(req, req.body?.config || {}, startedAt);
    logAiError('analyze-sentence.error', debugInfo, e);
    error(res, `${e.message} [requestId=${debugInfo.requestId}]`, 400);
  }
});

export default router;