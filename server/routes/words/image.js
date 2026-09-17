import { Router } from 'express';
import multer from 'multer';
import { Word } from '../../models/index.js';
import { success, error, handleRouteError } from '../../utils/response.js';
import {
  WORD_IMAGE,
  processWordImage,
  buildDownloadName,
  getWordImagePath,
} from '../../utils/wordImage.js';
import {
  saveWordImageFile,
  removeWordImageFile,
  wordImageFileExists,
} from '../../services/word-image-store.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WORD_IMAGE.MAX_ORIGINAL_BYTES, files: 1 },
});

const parseWordId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const findOwnedWord = (req, wordId) => Word.findOne({ where: { id: wordId, userId: req.userId } });

const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return error(res, '原始图片不能超过 5MB', 400);
    }
    return error(res, err.message || '上传失败', 400);
  });
};

router.post('/:id/image', handleUpload, async (req, res) => {
  try {
    const wordId = parseWordId(req.params.id);
    if (!wordId) return error(res, '单词 ID 无效', 400);

    const word = await findOwnedWord(req, wordId);
    if (!word) return error(res, '单词不存在', 404);
    if (!req.file?.buffer) return error(res, '请选择要上传的图片', 400);

    const processed = await processWordImage(req.file.buffer);
    const hadImage = Boolean(word.imageExt);
    await saveWordImageFile(req.userId, word.id, processed.buffer);
    await word.update({ imageExt: WORD_IMAGE.OUTPUT_EXT });

    success(
      res,
      {
        hasImage: true,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      },
      hadImage ? '记忆图片已替换' : '记忆图片已保存'
    );
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get('/:id/image', async (req, res) => {
  try {
    const wordId = parseWordId(req.params.id);
    if (!wordId) return error(res, '单词 ID 无效', 400);

    const word = await findOwnedWord(req, wordId);
    if (!word) return error(res, '单词不存在', 404);
    if (!word.imageExt) return error(res, '该单词尚未上传记忆图片', 404);

    const filePath = getWordImagePath(req.userId, word.id);
    if (!(await wordImageFileExists(req.userId, word.id))) {
      return error(res, '记忆图片文件缺失', 404);
    }

    const download = ['1', 'true', 'download'].includes(String(req.query.download || ''));
    res.setHeader('Content-Type', WORD_IMAGE.OUTPUT_MIME);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      download
        ? `attachment; filename="${buildDownloadName(word.name)}"`
        : 'inline; filename="memory.jpg"'
    );
    res.sendFile(filePath);
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.delete('/:id/image', async (req, res) => {
  try {
    const wordId = parseWordId(req.params.id);
    if (!wordId) return error(res, '单词 ID 无效', 400);

    const word = await findOwnedWord(req, wordId);
    if (!word) return error(res, '单词不存在', 404);
    if (!word.imageExt) return error(res, '该单词尚未上传记忆图片', 404);

    await removeWordImageFile(req.userId, word.id);
    await word.update({ imageExt: null });
    success(res, { hasImage: false }, '记忆图片已删除');
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
