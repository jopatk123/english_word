import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { getDbPath } from './env.js';

export const WORD_IMAGE = {
  MIN_SHORT_SIDE: 640,
  MAX_LONG_SIDE: 1600,
  MIN_ASPECT: 0.5,
  MAX_ASPECT: 2,
  MAX_BYTES: 300 * 1024,
  MAX_ORIGINAL_BYTES: 5 * 1024 * 1024,
  OUTPUT_EXT: 'jpg',
  OUTPUT_MIME: 'image/jpeg',
  MIN_QUALITY: 72,
  MAX_QUALITY: 90,
  QUALITY_STEP: 3,
  SCALE_STEP: 0.9,
  ALLOWED_FORMATS: new Set(['jpeg', 'jpg', 'png', 'webp']),
};

const SHARP_INPUT = {
  failOn: 'error',
  limitInputPixels: 40_000_000,
};

export class WordImageError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.name = 'WordImageError';
    this.code = code;
  }
}

const readEnv = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

export function getUploadRoot() {
  const override = readEnv('UPLOAD_DIR');
  if (override) return path.resolve(override);
  if (process.env.NODE_ENV === 'test') {
    return path.join(os.tmpdir(), 'english-word-test-uploads');
  }
  return path.join(path.dirname(path.resolve(getDbPath())), 'uploads');
}

const assertPositiveInt = (value, label) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new WordImageError(`${label}无效`);
  }
  return numeric;
};

export function getUserImageDir(userId) {
  return path.join(getUploadRoot(), String(assertPositiveInt(userId, '用户 ID')));
}

export function getWordImagePath(userId, wordId) {
  return path.join(
    getUserImageDir(userId),
    `${assertPositiveInt(wordId, '单词 ID')}.${WORD_IMAGE.OUTPUT_EXT}`
  );
}

export function buildDownloadName(wordName) {
  const base = String(wordName || 'word')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'word'}-memory.jpg`;
}

export function validateImageMetrics(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w < WORD_IMAGE.MIN_SHORT_SIDE || h < WORD_IMAGE.MIN_SHORT_SIDE) {
    return {
      ok: false,
      message: `图片太小，最短边需至少 ${WORD_IMAGE.MIN_SHORT_SIDE} 像素（当前 ${w}×${h}）`,
    };
  }
  const aspect = w / h;
  if (aspect < WORD_IMAGE.MIN_ASPECT || aspect > WORD_IMAGE.MAX_ASPECT) {
    return {
      ok: false,
      message: '图片过长或过宽，请裁成接近方形、4:3 或 16:9（宽高比需在 1:2 到 2:1 之间）',
    };
  }
  return { ok: true, message: '' };
}

const scaleToMaxLongSide = (width, height) => {
  const longSide = Math.max(width, height);
  if (longSide <= WORD_IMAGE.MAX_LONG_SIDE) {
    return { width, height };
  }
  const scale = WORD_IMAGE.MAX_LONG_SIDE / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const shrinkSize = (width, height) => ({
  width: Math.max(1, Math.round(width * WORD_IMAGE.SCALE_STEP)),
  height: Math.max(1, Math.round(height * WORD_IMAGE.SCALE_STEP)),
});

const encodeJpeg = (inputBuffer, width, height, quality) =>
  sharp(inputBuffer, SHARP_INPUT)
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

/**
 * 将用户图片规范为 JPEG，并严格压到 300KB 以内。
 * 先保分辨率、下调 JPEG 质量；质量到底后再缩小边长。
 */
export async function processWordImage(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new WordImageError('请上传图片文件');
  }
  if (inputBuffer.length > WORD_IMAGE.MAX_ORIGINAL_BYTES) {
    throw new WordImageError('原始图片不能超过 5MB');
  }

  let metadata;
  try {
    metadata = await sharp(inputBuffer, SHARP_INPUT).metadata();
  } catch {
    throw new WordImageError('无法识别的图片，请上传 JPEG、PNG 或 WebP');
  }

  const format = String(metadata.format || '').toLowerCase();
  if (!WORD_IMAGE.ALLOWED_FORMATS.has(format)) {
    throw new WordImageError('仅支持 JPEG、PNG 或 WebP 图片');
  }

  // EXIF Orientation 5-8 表示需旋转 90°/270°，存储宽高与显示宽高互换。
  // metadata() 返回的是旋转前的存储尺寸（链式 .rotate() 对其无效），而
  // encodeJpeg 管道中的 .rotate() 会按 EXIF 自动旋转后再输出，因此必须
  // 换算成旋转后的显示尺寸再做校验与缩放，否则 resize(fit: 'fill') 会把
  // 已旋转的图片强行拉伸回旋转前的宽高，导致手机竖拍照片变形。
  const swapDims = metadata.orientation >= 5 && metadata.orientation <= 8;
  const sourceWidth = (swapDims ? metadata.height : metadata.width) || 0;
  const sourceHeight = (swapDims ? metadata.width : metadata.height) || 0;
  const metrics = validateImageMetrics(sourceWidth, sourceHeight);
  if (!metrics.ok) {
    throw new WordImageError(metrics.message);
  }

  let { width, height } = scaleToMaxLongSide(sourceWidth, sourceHeight);

  for (let step = 0; step < 24; step += 1) {
    for (
      let quality = WORD_IMAGE.MAX_QUALITY;
      quality >= WORD_IMAGE.MIN_QUALITY;
      quality -= WORD_IMAGE.QUALITY_STEP
    ) {
      const buffer = await encodeJpeg(inputBuffer, width, height, quality);
      if (buffer.length <= WORD_IMAGE.MAX_BYTES) {
        return { buffer, width, height, bytes: buffer.length, quality };
      }
    }

    const next = shrinkSize(width, height);
    if (Math.min(next.width, next.height) < WORD_IMAGE.MIN_SHORT_SIDE) {
      break;
    }
    width = next.width;
    height = next.height;
  }

  throw new WordImageError('无法将图片压缩到 300KB 以内，请换一张构图更简单的图');
}
