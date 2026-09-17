import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processWordImage, validateImageMetrics, WORD_IMAGE } from '../utils/wordImage.js';

const makeJpeg = ({ width, height, quality = 90, noise = false }) => {
  if (!noise) {
    return sharp({
      create: { width, height, channels: 3, background: { r: 36, g: 99, b: 188 } },
    })
      .jpeg({ quality })
      .toBuffer();
  }

  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 37 + 11) % 256;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
};

describe('validateImageMetrics', () => {
  it('拒绝最短边不足的图片', () => {
    const result = validateImageMetrics(320, 800);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/最短边/);
  });

  it('拒绝过宽或过长的比例', () => {
    const result = validateImageMetrics(1600, 700);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/过长或过宽/);
  });

  it('接受推荐范围内的尺寸', () => {
    expect(validateImageMetrics(1280, 800).ok).toBe(true);
    expect(validateImageMetrics(960, 960).ok).toBe(true);
  });
});

describe('processWordImage', () => {
  it('将合格图片规范为不超过 300KB 的 JPEG', async () => {
    const input = await makeJpeg({ width: 1280, height: 800, noise: true, quality: 95 });
    const result = await processWordImage(input);
    expect(result.bytes).toBeLessThanOrEqual(WORD_IMAGE.MAX_BYTES);
    expect(result.buffer.length).toBe(result.bytes);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(WORD_IMAGE.MIN_SHORT_SIDE);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('jpeg');
  });

  it('拒绝过小的图片', async () => {
    const input = await makeJpeg({ width: 200, height: 200 });
    await expect(processWordImage(input)).rejects.toThrow(/最短边/);
  });

  it('拒绝非图片数据', async () => {
    await expect(processWordImage(Buffer.from('not-an-image'))).rejects.toThrow(/无法识别/);
  });

  it('按 EXIF 方向旋转输出且不拉伸变形（Orientation=6 竖拍照片）', async () => {
    // 存储尺寸 800x1200 + EXIF Orientation=6（顺时针 90°）→ 显示应为 1200x800。
    // 若误用旋转前的存储宽高，输出会被 fit:'fill' 拉伸成 800x1200 导致变形。
    const stored = await makeJpeg({ width: 800, height: 1200 });
    const input = await sharp(stored).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    const result = await processWordImage(input);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(800);
    // 旋转已烘焙进像素，输出的 JPEG 不应再携带 EXIF 方向标签
    expect(meta.orientation).toBeUndefined();
  });
});
