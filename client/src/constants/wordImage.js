export const WORD_IMAGE = {
  MIN_SHORT_SIDE: 640,
  MAX_LONG_SIDE: 1600,
  MIN_ASPECT: 0.5,
  MAX_ASPECT: 2,
  MAX_BYTES: 300 * 1024,
  MAX_ORIGINAL_BYTES: 5 * 1024 * 1024,
  MIN_QUALITY: 0.72,
  MAX_QUALITY: 0.9,
  QUALITY_STEP: 0.03,
  SCALE_STEP: 0.9,
  OUTPUT_TYPE: 'image/jpeg',
  ACCEPT: 'image/jpeg,image/png,image/webp',
};

export const WORD_IMAGE_HINT = {
  recommended: '1280×800（16:10）或 1280×720（16:9）',
  square: '960×960（1:1）',
  minShortSide: WORD_IMAGE.MIN_SHORT_SIDE,
  maxLongSide: WORD_IMAGE.MAX_LONG_SIDE,
  maxBytesKB: Math.round(WORD_IMAGE.MAX_BYTES / 1024),
  maxOriginalMB: Math.round(WORD_IMAGE.MAX_ORIGINAL_BYTES / 1024 / 1024),
};

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

export function buildWordImageDownloadName(wordName) {
  const base = String(wordName || 'word')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'word'}-memory.jpg`;
}
