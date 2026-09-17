import { WORD_IMAGE, validateImageMetrics } from '../constants/wordImage.js';

const loadBitmap = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return createImageBitmap(file);
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片，请换一张 JPEG、PNG 或 WebP'));
    };
    image.src = url;
  });
};

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('浏览器无法压缩该图片，请换一张后重试'));
          return;
        }
        resolve(blob);
      },
      WORD_IMAGE.OUTPUT_TYPE,
      quality
    );
  });

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

const drawToCanvas = (source, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持图片压缩');
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
};

/**
 * 前端预压缩：先保分辨率，质量不够再缩小。
 * 已满足限制的原图直接返回，避免二次有损。
 */
export async function compressWordImageFile(file) {
  if (!(file instanceof Blob)) {
    throw new Error('请选择图片文件');
  }
  if (file.size > WORD_IMAGE.MAX_ORIGINAL_BYTES) {
    throw new Error('原始图片不能超过 5MB');
  }

  const bitmap = await loadBitmap(file);
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const metrics = validateImageMetrics(sourceWidth, sourceHeight);
    if (!metrics.ok) {
      throw new Error(metrics.message);
    }

    const sized = scaleToMaxLongSide(sourceWidth, sourceHeight);
    const alreadyFits =
      file.size <= WORD_IMAGE.MAX_BYTES &&
      sized.width === sourceWidth &&
      sized.height === sourceHeight &&
      (file.type === 'image/jpeg' || file.type === 'image/jpg');
    if (alreadyFits) {
      return file;
    }

    let width = sized.width;
    let height = sized.height;

    for (let step = 0; step < 24; step += 1) {
      const canvas = drawToCanvas(bitmap, width, height);
      for (
        let quality = WORD_IMAGE.MAX_QUALITY;
        quality >= WORD_IMAGE.MIN_QUALITY - 1e-6;
        quality -= WORD_IMAGE.QUALITY_STEP
      ) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob.size <= WORD_IMAGE.MAX_BYTES) {
          return new File([blob], 'memory.jpg', { type: WORD_IMAGE.OUTPUT_TYPE });
        }
      }

      const nextWidth = Math.max(1, Math.round(width * WORD_IMAGE.SCALE_STEP));
      const nextHeight = Math.max(1, Math.round(height * WORD_IMAGE.SCALE_STEP));
      if (Math.min(nextWidth, nextHeight) < WORD_IMAGE.MIN_SHORT_SIDE) {
        break;
      }
      width = nextWidth;
      height = nextHeight;
    }

    throw new Error('无法将图片压缩到 300KB 以内，请换一张构图更简单的图');
  } finally {
    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}
