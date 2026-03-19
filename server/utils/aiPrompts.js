/**
 * AI 请求的 Prompt 构建器与响应净化器
 *
 * Prompt 构建器：
 *   buildRootPrompt          - 推荐词根
 *   buildWordPrompt          - 推荐单词
 *   buildExamplePrompt       - 推荐例句
 *   buildAnalyzeWordPrompt   - 分析单词
 *   buildAnalyzeSentencePrompt - 分析句子
 *
 * 净化器（将 AI 原始返回 sanitize 为受信任的结构）：
 *   sanitizeAnalyzeWordResult
 *   sanitizeAnalyzeSentenceResult
 */

// ── 系统提示共用片段 ───────────────────────────────────────────
const JSON_ONLY_SYSTEM_PROMPT =
  `你是专业英语学习助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`;

// ── Prompt 构建器 ──────────────────────────────────────────────

export const buildRootPrompt = (roots) => {
  const existingRoots = roots.length
    ? roots.map((r) => `${r.name}: ${r.meaning}`).join('\n')
    : '当前还没有任何词根。';
  const existingRootNames = roots.length
    ? roots.map((r) => r.name).join(', ')
    : '无';

  return {
    systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
    userPrompt: `基于现有词根库，推荐1个**未收录**的常用英语词根。

规则（必须严格遵守）：
1. 只推荐一般常用、构词能力强的拉丁/希腊词根。
2. **绝对不能推荐以下已存在词根**：${existingRootNames}
3. 不能推荐近似重复词根。
4. 若无更多可推荐，返回空数组，hasMore: false。
5. **禁止返回 reason 和 remark 字段**。
6. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "name": "fer",
      "meaning": "带来；携带"
    }
  ]
}

已有词根：
${existingRoots}`,
  };
};

export const buildWordPrompt = (root, words) => {
  const existingWords = words.length
    ? words.map((w) => `${w.name}: ${w.meaning}`).join('\n')
    : '当前该词根下还没有任何单词。';
  const existingWordNames = words.length
    ? words.map((w) => w.name).join(', ')
    : '无';

  return {
    systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
    userPrompt: `围绕词根【${root.name}（${root.meaning}）】推荐1个**未收录**的常用单词。

规则（必须严格遵守）：
1. 必须属于该词根，日常常用、适合学习。
2. **绝对不能推荐以下已存在单词**：${existingWordNames}
3. 若无更多可推荐，返回空数组，hasMore: false。
4. 每个单词必须返回词性信息（partOfSpeech），词性类型只能使用标准缩写（n./v./adj./adv./prep./pron./conj./interj./num./art./aux.）。
5. **禁止返回 reason 和 remark 字段**。
6. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "name": "inspect",
      "meaning": "检查；视察",
      "phonetic": "/ɪnˈspekt/",
      "partOfSpeech": [
        { "type": "v.", "meaning": "检查；视察" },
        { "type": "n.", "meaning": "检察官；视察人员" }
      ]
    }
  ]
}

已有单词：
${existingWords}`,
  };
};

export const buildExamplePrompt = (word, examples, excludedSentences = []) => {
  const existingExamples = examples.length
    ? examples.map((e) => `- ${e.sentence}`).join('\n')
    : '当前该单词下还没有任何例句。';

  const extraExcludedExamples = Array.isArray(excludedSentences) && excludedSentences.length
    ? excludedSentences.map((sentence) => `- ${sentence}`).join('\n')
    : '无';

  const rootsInfo = word.roots?.length
    ? word.roots.map((r) => `${r.name}（${r.meaning}）`).join('、')
    : '无';

  return {
    systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
    userPrompt: `为单词【${word.name}】生成1条**全新、不重复**的简短日常常用英文例句+中文翻译。

单词信息：
- 单词：${word.name}
- 含义：${word.meaning}
- 音标：${word.phonetic || '无'}
- 词根：${rootsInfo}

规则（必须严格遵守）：
1. 句子简短且句中的单词常用、简单、易学，能体现该单词的日常用法和语境。
2. **绝对不能与以下例句相同或高度相似**：
${existingExamples}
3. **还要避开本次已生成过（但未保存）的例句**：
${extraExcludedExamples}
4. 若无更多可推荐，返回空数组，hasMore: false。
5. **禁止返回 reason 和 remark 字段**。
6. 只返回标准JSON，格式如下：
{
  "message": "简短说明",
  "hasMore": true,
  "items": [
    {
      "sentence": "She inspected the room carefully.",
      "translation": "她仔细检查了房间。"
    }
  ]
}

已有例句（必须避开）：
${existingExamples}

本次额外避开列表（必须避开）：
${extraExcludedExamples}`,
  };
};

export const buildAnalyzeWordPrompt = (word, options = {}) => {
  const excludedSentences = Array.isArray(options?.excludedSentences)
    ? options.excludedSentences.map((item) => `${item || ''}`.trim()).filter(Boolean).slice(0, 20)
    : [];
  const singleExample = Boolean(options?.singleExample);
  const excludedText = excludedSentences.length
    ? excludedSentences.map((sentence) => `- ${sentence}`).join('\n')
    : '无';

  return {
    systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
    userPrompt: `分析英语单词【${word}】，返回其词性、含义、音标、词根和${singleExample ? '1条' : '根据不同词性各1条'}日常常用英文例句+中文翻译。

规则（必须严格遵守）：
1. 返回该单词所有常见词性及每种词性对应的中文含义，词性类型只能使用标准缩写（n./v./adj./adv./prep./pron./conj./interj./num./art./aux.）。
2. meaning 字段填写综合所有词性的主要中文含义（一句话简短概括）。
3. 仔细分析该单词的**所有词根**信息。一个单词可能有多个词根（如dialogue有词根 dia- 和 logue）。如果该单词有词根，以数组形式返回所有词根；如果没有词根（比如go,run,see等），roots 字段设为空数组 []。
4. ${singleExample
    ? '只生成 1 条日常常用英文例句，句子简短、自然、易学，且能体现该单词的典型用法。'
    : '根据词性数量生成相应数量的日常常用英文例句，每条例句简短且句中的单词常用、简单、易学，能体现不同词性或典型用法。'}
5. **绝对不能与以下例句相同或高度相似**：\n${excludedText}
6. 只返回标准JSON，格式如下：
{
  "word": "${word}",
  "meaning": "综合中文含义",
  "phonetic": "/音标/",
  "partOfSpeech": [
    { "type": "v.", "meaning": "动词含义" },
    { "type": "n.", "meaning": "名词含义" }
  ],
  "roots": [
    { "name": "词根名1", "meaning": "词根含义1" },
    { "name": "词根名2", "meaning": "词根含义2" }
  ],
  "examples": [
    {
      "sentence": "英文例句",
      "translation": "中文翻译"
    }
  ]
}

partOfSpeech的值数量不限，但必须包含所有常见词性；roots字段没有词根时必须返回空数组[]；examples字段至少要有1条例句。`,
  };
};

export const buildAnalyzeSentencePrompt = (sentence) => ({
  systemPrompt: `你是专业英语教学助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`,
  userPrompt: `分析以下英文句子，帮助用户学习理解：

句子：${sentence}

规则（必须严格遵守）：
1. 提供中文翻译
2. 简单分析句子的语法结构
3. 列出关键词汇及其含义
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

// ── 净化器 ────────────────────────────────────────────────────

const VALID_POS_TYPES = new Set([
  'n.', 'v.', 'adj.', 'adv.', 'prep.',
  'pron.', 'conj.', 'interj.', 'num.', 'art.', 'aux.',
]);

/**
 * 将 AI 返回的单词分析结果净化为受信任结构。
 * @param {unknown} parsed - AI 解析后的原始对象
 * @param {string} word - 原始查询单词（作为兜底）
 * @returns {object|null} 净化后的结果，meaning 为空时返回 null
 */
export const sanitizeAnalyzeWordResult = (parsed, word) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const result = {
    word: (parsed.word || word).trim().toLowerCase().slice(0, 60),
    meaning: (parsed.meaning || '').trim().slice(0, 200),
    phonetic: (parsed.phonetic || '').trim().slice(0, 80),
    partOfSpeech: [],
    roots: [],
    examples: [],
  };

  for (const item of Array.isArray(parsed.partOfSpeech) ? parsed.partOfSpeech : []) {
    const type = (item?.type || '').trim().toLowerCase();
    const meaning = (item?.meaning || '').trim().slice(0, 160);
    if (VALID_POS_TYPES.has(type) && meaning) {
      result.partOfSpeech.push({ type, meaning });
      if (result.partOfSpeech.length >= 8) break;
    }
  }

  // 兼容旧格式 root 单对象
  const rawRoots = Array.isArray(parsed.roots)
    ? parsed.roots
    : (parsed.root?.name ? [parsed.root] : []);
  for (const rootItem of rawRoots) {
    const name = (rootItem?.name || '').trim().toLowerCase().slice(0, 40);
    const meaning = (rootItem?.meaning || '').trim().slice(0, 80);
    if (/^[a-z-]{2,40}$/.test(name) && meaning) {
      result.roots.push({ name, meaning });
      if (result.roots.length >= 5) break;
    }
  }

  for (const item of Array.isArray(parsed.examples) ? parsed.examples : []) {
    const sentence = (item?.sentence || '').trim().slice(0, 400);
    const translation = (item?.translation || '').trim().slice(0, 240);
    if (sentence && translation && sentence.length >= 5) {
      result.examples.push({ sentence, translation });
      if (result.examples.length >= 3) break;
    }
  }

  return result.meaning ? result : null;
};

/**
 * 将 AI 返回的句子分析结果净化为受信任结构。
 * @param {unknown} parsed - AI 解析后的原始对象
 * @param {string} sentence - 原始查询句子（作为兜底）
 * @returns {object|null} 净化后的结果，translation 为空时返回 null
 */
export const sanitizeAnalyzeSentenceResult = (parsed, sentence) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const result = {
    sentence: (parsed.sentence || sentence).trim().slice(0, 500),
    translation: (parsed.translation || '').trim().slice(0, 500),
    grammar: (parsed.grammar || '').trim().slice(0, 1000),
    vocabulary: [],
  };

  for (const item of Array.isArray(parsed.vocabulary) ? parsed.vocabulary : []) {
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
