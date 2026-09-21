const LOOKUP_WORD_PATTERN = /^[a-z]+(?:[-'][a-z]+)*$/;
const TOKEN_PATTERN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

/**
 * 与服务端 normalizeLookupWord 保持同一规则：
 * 小写、弯引号拉直、去掉所有格 's，缩写保留。
 */
export function normalizeLookupWord(raw) {
  if (typeof raw !== 'string') return '';
  let word = raw.trim().toLowerCase().replace(/’/g, "'");
  if (word.endsWith("'s")) word = word.slice(0, -2);
  if (!word || word.length > 60 || !LOOKUP_WORD_PATTERN.test(word)) return '';
  return word;
}

/**
 * 把例句拆成可点击单词和原样保留的空白/标点。
 * @returns {{ text: string, word: string }[]}
 */
export function tokenizeSentence(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source) return [];

  const tokens = [];
  let lastIndex = 0;
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, index), word: '' });
    }
    const raw = match[0];
    tokens.push({ text: raw, word: normalizeLookupWord(raw) });
    lastIndex = index + raw.length;
  }
  if (lastIndex < source.length) {
    tokens.push({ text: source.slice(lastIndex), word: '' });
  }
  return tokens;
}
