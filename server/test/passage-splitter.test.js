import { describe, it, expect } from 'vitest';
import {
  splitParagraphs,
  splitSentences,
  splitPassage,
  splitTranslation,
  alignTranslations,
  carryOverTranslations,
  countWords,
} from '../services/passage-splitter.js';

describe('splitSentences', () => {
  it('按句末标点切句', () => {
    expect(splitSentences('I like tea. Do you? Yes!')).toEqual(['I like tea.', 'Do you?', 'Yes!']);
  });

  it('称谓缩写不切开', () => {
    expect(splitSentences('Mr. Smith met Dr. Brown. They talked.')).toEqual([
      'Mr. Smith met Dr. Brown.',
      'They talked.',
    ]);
  });

  it('姓名首字母不切开', () => {
    expect(splitSentences('J. K. Rowling wrote it. It sold well.')).toEqual([
      'J. K. Rowling wrote it.',
      'It sold well.',
    ]);
  });

  it('常见缩写、小数、省略号和引号', () => {
    expect(
      splitSentences(
        'He lives in Washington, D.C. now. It is 3.5 km away. See e.g. the U.S. report. Then he left... She said, "Hello there!" OK.'
      )
    ).toEqual([
      'He lives in Washington, D.C. now.',
      'It is 3.5 km away.',
      'See e.g. the U.S. report.',
      'Then he left...',
      'She said, "Hello there!"',
      'OK.',
    ]);
  });

  it('没有句末标点的最后一句也保留', () => {
    expect(splitSentences('First one. The end')).toEqual(['First one.', 'The end']);
  });

  it('空文本返回空数组', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('splitParagraphs', () => {
  it('空行分段，并合并多余空白', () => {
    expect(splitParagraphs('A  b.\n\n\n  C d.  ')).toEqual(['A b.', 'C d.']);
  });

  it('句末换行视为分段，句中换行视为折行', () => {
    expect(splitParagraphs('First line ends.\nSecond line\ncontinues here.\r\nThird.')).toEqual([
      'First line ends.',
      'Second line continues here.',
      'Third.',
    ]);
  });
});

describe('splitPassage', () => {
  it('给出顺序、段落下标、规范化正文和词数', () => {
    const result = splitPassage("It's sunny. We go out.\n\nThe well-known park is big.");
    expect(result.content).toBe("It's sunny. We go out.\n\nThe well-known park is big.");
    expect(result.sentences).toEqual([
      { orderIndex: 0, paragraphIndex: 0, text: "It's sunny." },
      { orderIndex: 1, paragraphIndex: 0, text: 'We go out.' },
      { orderIndex: 2, paragraphIndex: 1, text: 'The well-known park is big.' },
    ]);
    expect(result.wordCount).toBe(10);
  });

  it('countWords 忽略数字和标点', () => {
    expect(countWords('In 2024, 3 cats — and dogs!')).toBe(4);
  });
});

describe('splitTranslation / alignTranslations', () => {
  it('中文按句末标点切分，右引号跟随前一句', () => {
    expect(splitTranslation('他说：“你好！”然后走了。真的吗？')).toEqual([
      '他说：“你好！”',
      '然后走了。',
      '真的吗？',
    ]);
  });

  it('句数一致时逐句对应', () => {
    expect(alignTranslations(2, '今天晴。我们出门。')).toEqual({
      translations: ['今天晴。', '我们出门。'],
      aligned: true,
    });
  });

  it('句数不一致时整段放进第一句', () => {
    expect(alignTranslations(3, '今天晴，\n我们出门。')).toEqual({
      translations: ['今天晴， 我们出门。', null, null],
      aligned: false,
    });
  });

  it('没有译文时全部为空', () => {
    expect(alignTranslations(2, '  ')).toEqual({ translations: [null, null], aligned: true });
  });
});

describe('carryOverTranslations', () => {
  it('原句不变的保留译文，同文多句按顺序匹配', () => {
    const oldSentences = [
      { text: 'Hi.', translation: '你好1' },
      { text: 'Old one.', translation: '旧句' },
      { text: 'Hi.', translation: '你好2' },
    ];
    const next = carryOverTranslations(
      [{ text: 'Hi.' }, { text: 'New one.' }, { text: 'Hi.' }, { text: 'Hi.' }],
      oldSentences
    );
    expect(next.map((s) => s.translation)).toEqual(['你好1', null, '你好2', null]);
  });
});
