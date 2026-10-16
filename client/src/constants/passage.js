export const PASSAGE_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const PASSAGE_MAX_CONTENT_LENGTH = 8000;
export const PASSAGE_MAX_TRANSLATION_LENGTH = 16000;
export const PASSAGE_MAX_TITLE_LENGTH = 120;

export const PASSAGE_STATUS_OPTIONS = Object.freeze([
  { value: 'unread', label: '未读', tagType: 'info' },
  { value: 'due', label: '待重读', tagType: 'danger' },
  { value: 'learning', label: '学习中', tagType: 'warning' },
  { value: 'mastered', label: '熟练', tagType: 'success' },
]);

export const PASSAGE_STATUS_MAP = Object.freeze(
  Object.fromEntries(PASSAGE_STATUS_OPTIONS.map((option) => [option.value, option]))
);

export const PASSAGE_RATINGS = Object.freeze([
  { value: 'hard', label: '吃力', hint: '明天再读一遍' },
  { value: 'good', label: '一般', hint: '按间隔推后' },
  { value: 'easy', label: '轻松', hint: '间隔推得更远' },
]);

export const PASSAGE_LENGTH_OPTIONS = Object.freeze([
  { value: 'short', label: '短（约 120 词）' },
  { value: 'medium', label: '中（约 250 词）' },
  { value: 'long', label: '长（约 400 词）' },
]);

export const PASSAGE_SPEECH_RATES = Object.freeze([
  { value: 0.6, label: '慢' },
  { value: 0.85, label: '标准' },
  { value: 1, label: '稍快' },
  { value: 1.2, label: '快' },
]);

export const PASSAGE_SPEECH_RATE_STORAGE_KEY = 'english-word-passage-speech-rate';
