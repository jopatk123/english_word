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
    systemPrompt: '你是英语词根学习助手。你只能返回 JSON，不允许输出 markdown、解释文本或多余字段。',
    userPrompt: `请基于当前词根库，推荐最多 8 个“还未收录”的常用英语词根。\n\n要求：\n1. 频率要求放宽到“一般常用、对背单词有帮助”即可，不必局限于最顶级高频词根。\n2. 严禁输出任何已存在的词根，也不要输出近似重复词根；如果输出已存在词根，这些结果会被直接丢弃。\n3. 已存在词根名单：${existingRootNames}。请逐项避开。\n4. 优先选择适合词根记忆法、构词能力较强的拉丁或希腊词根。\n5. 如果确实没有可补充项，再返回空数组，并把 hasMore 设为 false。\n6. 不要输出 remark 字段，节省内容长度。\n7. 只返回严格 JSON，格式如下：\n{\n  "message": "给用户的简短说明",\n  "hasMore": true,\n  "items": [\n    {\n      "name": "fer",\n      "meaning": "带来；携带",\n      "reason": "当前库缺少这个常用词根，且构词能力强"\n    }\n  ]\n}\n\n当前已有词根详情：\n${existingRoots}`,
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
    systemPrompt: '你是英语词根背单词助手。你只能返回 JSON，不允许输出 markdown、解释文本或多余字段。',
    userPrompt: `请围绕词根“${root.name}（${root.meaning}）”推荐最多 10 个还未收录的常用英语单词。\n\n要求：\n1. 只推荐确实适合归到该词根下、一般常用且适合学习的英语单词。\n2. 严禁输出任何已存在的单词；如果输出已存在单词，这些结果会被直接丢弃。\n3. 已存在单词名单：${existingWordNames}。请逐项避开。\n4. 如果已经没有明显适合继续补充的常用单词，再返回空数组，并把 hasMore 设为 false。\n5. 尽量给出简洁中文含义；音标可留空字符串。\n6. 不要输出 remark 字段，节省内容长度。\n7. 只返回严格 JSON，格式如下：\n{\n  "message": "给用户的简短说明",\n  "hasMore": true,\n  "items": [\n    {\n      "name": "inspect",\n      "meaning": "检查；视察",\n      "phonetic": "/ɪnˈspekt/",\n      "reason": "由 in + spect 构成，符合词根语义"\n    }\n  ]\n}\n\n当前词根：${root.name} - ${root.meaning}\n当前已有单词详情：\n${existingWords}`,
  };
};

const buildExamplePrompt = (word, examples) => {
  const existingExamples = examples.length
    ? examples.map((example) => `- ${example.sentence} | ${example.translation}`).join('\n')
    : '当前该单词下还没有任何例句。';

  return {
    systemPrompt: '你是英语例句学习助手。你只能返回 JSON，不允许输出 markdown、解释文本或多余字段。',
    userPrompt: `请围绕英语单词“${word.name}”生成最多 6 条还未收录的高质量英文例句，并给出中文翻译。\n\n单词信息：\n- 单词：${word.name}\n- 含义：${word.meaning}\n- 音标：${word.phonetic || '无'}\n- 词根：${word.root?.name || '无'}（${word.root?.meaning || '无'}）\n\n要求：\n1. 例句必须自然、常见、语法正确，能体现这个单词的一般常用用法。\n2. 严禁输出与已有例句相同或高度相似的句子。\n3. 如果当前已经没有明显值得补充的常用例句，再返回空数组，并把 hasMore 设为 false。\n4. 不要输出 remark 字段，节省内容长度。\n5. 只返回严格 JSON，格式如下：\n{\n  "message": "给用户的简短说明",\n  "hasMore": true,\n  "items": [\n    {\n      "sentence": "The team will launch the project next month.",\n      "translation": "团队将于下个月启动这个项目。",\n      "reason": "体现 project 的常见名词用法"\n    }\n  ]\n}\n\n当前已有例句：\n${existingExamples}`,
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
    const roots = await Root.findAll({ order: [['name', 'ASC']] });
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
    if (!root) return error(res, '词根不存在', 404);

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
      include: [{ model: Root, as: 'root', attributes: ['id', 'name', 'meaning'] }],
    });
    if (!word) return error(res, '单词不存在', 404);

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

export default router;