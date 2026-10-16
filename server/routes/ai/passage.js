import { Router } from 'express';
import { requestAiJson } from '../../utils/ai.js';
import { createDebugInfo, handleAiError, logAiInfo, withDuration } from '../../utils/aiDebug.js';
import {
  PASSAGE_LENGTHS,
  buildGeneratePassagePrompt,
  sanitizeGeneratedPassage,
} from '../../utils/aiPassagePrompts.js';
import { success, error } from '../../utils/response.js';
import { resolveUserAiConfig } from '../../services/user-ai-settings.js';
import { PASSAGE_LEVELS } from '../../services/passage-store.js';
import {
  buildGeneratedPreview,
  pickLearningWords,
  translateMissingSentences,
} from '../../services/passage-ai.js';

const router = Router();

const MAX_TOPIC_LENGTH = 60;
const DEFAULT_LEVEL = 'B1';

// 只生成预览，不入库；用户确认后走 POST /api/passages 保存
router.post('/generate-passage', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { topic: rawTopic = '', level = DEFAULT_LEVEL, length = 'medium' } = req.body || {};
    if (typeof rawTopic !== 'string' || rawTopic.trim().length > MAX_TOPIC_LENGTH) {
      return error(res, `主题需为不超过 ${MAX_TOPIC_LENGTH} 个字符的文本`, 400);
    }
    if (!PASSAGE_LEVELS.includes(level)) return error(res, '难度只能是 A1 到 C2', 400);
    if (!Object.hasOwn(PASSAGE_LENGTHS, length)) return error(res, '长度只能是短、中、长', 400);

    const topic = rawTopic.trim();
    const validatedConfig = await resolveUserAiConfig(req.userId, req.body?.config || {});
    const targetWords =
      req.body?.useLearningWords === true ? await pickLearningWords(req.userId) : [];
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('generate-passage.start', debugInfo, {
      level,
      length,
      targetWordCount: targetWords.length,
    });

    const payload = await requestAiJson(
      validatedConfig,
      buildGeneratePassagePrompt({ topic, level, length, targetWords })
    );
    const generated = sanitizeGeneratedPassage(payload);
    if (!generated) return error(res, 'AI 返回的短文无效，请重试', 400);

    const preview = buildGeneratedPreview(generated, { topic, level, targetWords });
    logAiInfo('generate-passage.success', debugInfo, {
      sentenceCount: preview.sentences.length,
      usedWordCount: preview.usedWords.length,
    });
    success(res, { passage: preview, debug: withDuration(debugInfo) });
  } catch (e) {
    handleAiError(res, req, startedAt, 'generate-passage', e);
  }
});

router.post('/translate-passage', async (req, res) => {
  const startedAt = Date.now();
  try {
    const passageId = Number(req.body?.passageId);
    if (!Number.isInteger(passageId) || passageId <= 0) return error(res, '缺少短文 ID', 400);

    const validatedConfig = await resolveUserAiConfig(req.userId, req.body?.config || {});
    const debugInfo = createDebugInfo(req, validatedConfig, startedAt);
    logAiInfo('translate-passage.start', debugInfo, { passageId });

    const result = await translateMissingSentences(req.userId, passageId, (prompts) =>
      requestAiJson(validatedConfig, prompts)
    );
    logAiInfo('translate-passage.success', debugInfo, {
      passageId,
      translatedCount: result.translatedCount,
      missingCount: result.missingCount,
    });

    const msg = result.missingCount
      ? `已翻译 ${result.translatedCount} 句，还有 ${result.missingCount} 句未能翻译`
      : result.translatedCount
        ? `已翻译 ${result.translatedCount} 句`
        : '所有句子都已有译文';
    success(res, { ...result, debug: withDuration(debugInfo) }, msg);
  } catch (e) {
    handleAiError(res, req, startedAt, 'translate-passage', e, { passageId: req.body?.passageId });
  }
});

export default router;
