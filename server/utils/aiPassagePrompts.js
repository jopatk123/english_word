/**
 * 短文模块的 AI Prompt 构建器与响应净化器
 *   buildGeneratePassagePrompt / sanitizeGeneratedPassage - 按主题和难度生成短文
 *   buildTranslateSentencesPrompt / sanitizeSentenceTranslations - 逐句翻译
 */

const JSON_ONLY_SYSTEM_PROMPT = `你是专业英语学习助手。
**必须只返回合法JSON，绝对不能输出：解释、说明、markdown、代码块、多余文字、思考过程。**
字段必须严格遵守，不能新增字段，不能少字段。`;

export const PASSAGE_LENGTHS = Object.freeze({
  short: { words: 120, paragraphs: '1-2' },
  medium: { words: 250, paragraphs: '2-3' },
  long: { words: 400, paragraphs: '3-5' },
});

const LEVEL_HINTS = {
  A1: '只用最基础的高频词和简单句',
  A2: '用常见日常词汇，以简单句为主，少量并列句',
  B1: '用常见词汇，可以有简单从句',
  B2: '词汇较丰富，可以使用多种从句和常见习语',
  C1: '用丰富、地道的词汇和复杂句式',
  C2: '接近母语水平的文章，词汇和句式不受限制',
};

const MAX_SENTENCE_LENGTH = 500;
const MAX_TRANSLATION_LENGTH = 1000;
const MAX_GENERATED_SENTENCES = 200;

export const buildGeneratePassagePrompt = ({ topic, level, length, targetWords = [] }) => {
  const { words, paragraphs } = PASSAGE_LENGTHS[length];
  const topicLine = topic ? `主题：${topic}` : '主题：自选一个贴近日常生活的话题';
  const targetRule = targetWords.length
    ? `5. 尽量自然地用上这些单词（可以变形，例如复数、过去式）：${targetWords.join(', ')}。不要为了凑词而生硬堆砌。`
    : '5. 不需要指定词汇。';

  return {
    systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
    userPrompt: `为英语学习者写一篇英文短文。

${topicLine}
难度：CEFR ${level}（${LEVEL_HINTS[level]}）
长度：约 ${words} 个英文单词，${paragraphs} 段

规则（必须严格遵守）：
1. 内容积极、事实准确，是一篇完整的小短文，有开头和结尾。
2. 每个元素是一个完整的英文句子，不要把两句合并成一个元素。
3. 每句都附上自然流畅的中文翻译。
4. 标题用英文，不超过 10 个单词。
${targetRule}
6. 只返回标准JSON，格式如下：
{
  "title": "A Rainy Morning",
  "paragraphs": [
    [
      { "en": "It was raining when Lily woke up.", "zh": "莉莉醒来时正在下雨。" }
    ]
  ]
}`,
  };
};

const cleanText = (value, maxLength) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';

/**
 * 净化生成结果：去掉空句、非英文句子和空段落，句子总数封顶。
 * @returns {{ title: string, paragraphs: { en: string, zh: string }[][] } | null}
 */
export const sanitizeGeneratedPassage = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const paragraphs = [];
  let total = 0;
  for (const rawParagraph of Array.isArray(parsed.paragraphs) ? parsed.paragraphs : []) {
    const paragraph = [];
    for (const item of Array.isArray(rawParagraph) ? rawParagraph : []) {
      const en = cleanText(item?.en, MAX_SENTENCE_LENGTH);
      if (!/[A-Za-z]/.test(en)) continue;
      paragraph.push({ en, zh: cleanText(item?.zh, MAX_TRANSLATION_LENGTH) });
      total += 1;
      if (total >= MAX_GENERATED_SENTENCES) break;
    }
    if (paragraph.length) paragraphs.push(paragraph);
    if (total >= MAX_GENERATED_SENTENCES) break;
  }

  if (!paragraphs.length) return null;
  return { title: cleanText(parsed.title, 120), paragraphs };
};

export const buildTranslateSentencesPrompt = (title, sentences) => ({
  systemPrompt: JSON_ONLY_SYSTEM_PROMPT,
  userPrompt: `把下面这篇英文短文中的句子逐句翻译成自然流畅的中文。

短文标题：${title}

规则（必须严格遵守）：
1. 每个 i 对应一句，必须原样返回 i，不能遗漏、合并或拆分。
2. 翻译要结合上下文，保持人名、地名前后一致。
3. 只返回标准JSON，格式如下：
{
  "items": [
    { "i": 0, "zh": "中文译文" }
  ]
}

待翻译的句子：
${JSON.stringify(sentences.map((s) => ({ i: s.i, en: s.text })))}`,
});

/**
 * 只保留请求过的下标，且每个下标只取第一次出现的译文。
 * @returns {Map<number, string>}
 */
export const sanitizeSentenceTranslations = (parsed, allowedIndexes) => {
  const allowed = new Set(allowedIndexes);
  const result = new Map();
  for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
    const index = Number(item?.i);
    const zh = cleanText(item?.zh, MAX_TRANSLATION_LENGTH);
    if (!allowed.has(index) || !zh || result.has(index)) continue;
    result.set(index, zh);
  }
  return result;
};
