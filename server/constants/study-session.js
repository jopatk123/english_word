/** 单次学习会话服务端硬上限（秒） */
export const MAX_SESSION_DURATION_SECONDS = 120 * 60;

/** 用户全部 WebSocket 断开后，自动停止前的宽限时间（毫秒） */
export const DISCONNECT_GRACE_MS = 15 * 60 * 1000;

/** 扫描仍活跃且可能已超过硬上限的会话（毫秒） */
export const MAX_DURATION_SWEEP_INTERVAL_MS = 60 * 1000;

export const STUDY_SESSION_END_REASONS = Object.freeze({
  MANUAL: 'manual',
  REST_ALARM: 'rest_alarm',
  MAX_DURATION: 'max_duration',
  DISCONNECT_GRACE: 'disconnect_grace',
  PAGE_CLOSE: 'page_close',
});

const ALLOWED_END_REASONS = new Set(Object.values(STUDY_SESSION_END_REASONS));

export function normalizeStudySessionEndReason(
  reason,
  fallback = STUDY_SESSION_END_REASONS.MANUAL
) {
  if (typeof reason === 'string' && ALLOWED_END_REASONS.has(reason)) {
    return reason;
  }
  return fallback;
}

export function isAllowedStudySessionEndReason(reason) {
  return typeof reason === 'string' && ALLOWED_END_REASONS.has(reason);
}
