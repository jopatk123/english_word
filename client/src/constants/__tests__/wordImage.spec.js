import { describe, expect, it } from 'vitest';
import { validateImageMetrics, buildWordImageDownloadName } from '../wordImage.js';

describe('validateImageMetrics', () => {
  it('最短边不足时给出明确提示', () => {
    const result = validateImageMetrics(500, 800);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/640/);
  });

  it('过宽比例会被拒绝', () => {
    expect(validateImageMetrics(1600, 400).ok).toBe(false);
  });

  it('推荐分辨率可以通过', () => {
    expect(validateImageMetrics(1280, 800).ok).toBe(true);
    expect(validateImageMetrics(1280, 720).ok).toBe(true);
  });
});

describe('buildWordImageDownloadName', () => {
  it('用单词名生成下载文件名', () => {
    expect(buildWordImageDownloadName('Apple Pie')).toBe('apple-pie-memory.jpg');
  });
});
