import { Router } from 'express';
import { success, handleRouteError } from '../utils/response.js';
import {
  deleteUserAiKey,
  getUserAiKeySummary,
  saveUserAiKey,
} from '../services/user-ai-settings.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    success(res, await getUserAiKeySummary(req.userId));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put('/', async (req, res) => {
  try {
    const { providerId, apiKey } = req.body || {};
    const result = await saveUserAiKey(req.userId, providerId, apiKey);
    success(res, result, 'AI Key 已加密保存到服务端');
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.delete('/providers/:providerId', async (req, res) => {
  try {
    await deleteUserAiKey(req.userId, req.params.providerId);
    success(res, null, 'AI Key 已删除');
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;
