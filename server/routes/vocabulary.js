import { Router } from 'express';
import { success, handleRouteError } from '../utils/response.js';
import { parseOptionalBool, parseOptionalInt } from '../utils/queryFlags.js';
import { buildVocabularyAudit } from '../services/vocab-audit.js';

const router = Router();

// 轻量词库审计：计数 + 小样本，不含例句正文，供 Agent / 运维巡检
router.get('/audit', async (req, res) => {
  try {
    const data = await buildVocabularyAudit(req.userId, {
      minExamples: parseOptionalInt(req.query.minExamples),
      sampleLimit: parseOptionalInt(req.query.sampleLimit),
      lemmaCheck: parseOptionalBool(req.query.lemmaCheck) !== false,
    });
    success(res, data);
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
