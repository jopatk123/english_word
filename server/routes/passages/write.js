import { Router } from 'express';
import { sequelize, PassageSentence, PassageReview } from '../../models/index.js';
import { success, handleRouteError } from '../../utils/response.js';
import { todayStr } from '../../utils/srs.js';
import {
  MAX_SENTENCE_TRANSLATION_LENGTH,
  PassageError,
  createPassage,
  findOwnedPassage,
  loadPassageDetail,
  parsePassageInput,
  serializeSentence,
  updatePassage,
} from '../../services/passage-store.js';

const router = Router();

const alignmentMessage = (base, translationAligned) =>
  translationAligned ? base : `${base}；译文句数与原文不一致，已整段放在第一句`;

router.post('/', async (req, res) => {
  try {
    const input = parsePassageInput(req.body);
    const { passage, translationAligned } = await createPassage(req.userId, input);
    const detail = await loadPassageDetail(req.userId, passage.id, todayStr(req.body.tz));
    success(
      res,
      { ...detail, translationAligned },
      alignmentMessage('保存成功', translationAligned)
    );
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put('/:id', async (req, res) => {
  try {
    // 编辑时不允许修改来源和主题
    const input = parsePassageInput({ ...req.body, source: undefined, topic: undefined });
    const { passage, translationAligned } = await updatePassage(req.userId, req.params.id, input);
    const detail = await loadPassageDetail(req.userId, passage.id, todayStr(req.body.tz));
    success(
      res,
      { ...detail, translationAligned },
      alignmentMessage('保存成功', translationAligned)
    );
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await sequelize.transaction(async (transaction) => {
      const passage = await findOwnedPassage(req.userId, req.params.id, { transaction });
      await PassageSentence.destroy({ where: { passageId: passage.id }, transaction });
      await PassageReview.destroy({ where: { passageId: passage.id }, transaction });
      await passage.destroy({ transaction });
    });
    success(res, null, '删除成功');
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put('/:id/sentences/:sentenceId', async (req, res) => {
  try {
    const passage = await findOwnedPassage(req.userId, req.params.id);
    const sentence = await PassageSentence.findOne({
      where: { id: req.params.sentenceId, passageId: passage.id },
    });
    if (!sentence) throw new PassageError('句子不存在', 404);

    const { translation } = req.body;
    if (translation !== null && translation !== undefined && typeof translation !== 'string') {
      throw new PassageError('译文必须为字符串');
    }
    const trimmed = (translation || '').trim();
    if (trimmed.length > MAX_SENTENCE_TRANSLATION_LENGTH) {
      throw new PassageError(`单句译文不能超过 ${MAX_SENTENCE_TRANSLATION_LENGTH} 个字符`);
    }

    await sentence.update({ translation: trimmed || null });
    success(res, serializeSentence(sentence), '译文已保存');
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
