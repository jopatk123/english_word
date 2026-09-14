import { Op } from 'sequelize';
import { StudySession } from '../models/index.js';
import {
  MAX_SESSION_DURATION_SECONDS,
  STUDY_SESSION_END_REASONS,
} from '../constants/study-session.js';
async function findActiveStudySession(userId) {
  return StudySession.findOne({
    where: { userId, endedAt: null },
    order: [
      ['started_at', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

export function getSessionStartedAtMs(session) {
  const startedAtMs = new Date(session?.startedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs : NaN;
}

export function getMaxAllowedEndMs(session) {
  const startedAtMs = getSessionStartedAtMs(session);
  if (!Number.isFinite(startedAtMs)) return NaN;
  return startedAtMs + MAX_SESSION_DURATION_SECONDS * 1000;
}

export function computeCappedDurationSeconds(session, endedAt) {
  const startedAtMs = getSessionStartedAtMs(session);
  const endedAtMs = new Date(endedAt).getTime();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return 0;
  }

  const rawSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));
  return Math.min(MAX_SESSION_DURATION_SECONDS, rawSeconds);
}

export function shouldAutoEndForMaxDuration(session, serverNow = new Date()) {
  if (!session || session.endedAt) return false;
  const maxEndMs = getMaxAllowedEndMs(session);
  if (!Number.isFinite(maxEndMs)) return false;
  return serverNow.getTime() >= maxEndMs;
}

export function getMaxDurationEndedAt(session) {
  const maxEndMs = getMaxAllowedEndMs(session);
  return Number.isFinite(maxEndMs) ? new Date(maxEndMs) : new Date();
}

export async function finalizeStudySession(session, { reason, endedAt }) {
  if (!session || session.endedAt) {
    return { session, ended: false };
  }

  const resolvedEndedAt = endedAt instanceof Date ? endedAt : new Date(endedAt);
  const durationSeconds = computeCappedDurationSeconds(session, resolvedEndedAt);

  await session.update({
    endedAt: resolvedEndedAt,
    durationSeconds,
    endReason: reason,
  });

  return { session, ended: true };
}

export async function endActiveStudySessionForUser(userId, { reason, endedAt, publishTimerState }) {
  const activeSession = await findActiveStudySession(userId);
  if (!activeSession) {
    return { ended: false, session: null };
  }

  const result = await finalizeStudySession(activeSession, { reason, endedAt });
  if (result.ended && typeof publishTimerState === 'function') {
    await publishTimerState(userId);
  }

  return result;
}

export async function settleActiveSessionIfNeeded(userId, options = {}) {
  const serverNow = options.serverNow ?? new Date();
  const publishTimerState = options.publishTimerState;
  const activeSession = options.activeSession ?? (await findActiveStudySession(userId));

  if (!activeSession || !shouldAutoEndForMaxDuration(activeSession, serverNow)) {
    return { session: activeSession, settled: false };
  }

  const result = await finalizeStudySession(activeSession, {
    reason: STUDY_SESSION_END_REASONS.MAX_DURATION,
    endedAt: getMaxDurationEndedAt(activeSession),
  });

  if (result.ended && typeof publishTimerState === 'function') {
    await publishTimerState(userId);
  }

  return { session: null, settled: true, endedSession: result.session };
}

export async function sweepOverMaxDurationActiveSessions(options = {}) {
  const serverNow = options.serverNow ?? new Date();
  const publishTimerState = options.publishTimerState;
  const cutoff = new Date(serverNow.getTime() - MAX_SESSION_DURATION_SECONDS * 1000);

  const overdueSessions = await StudySession.findAll({
    where: {
      endedAt: null,
      startedAt: { [Op.lte]: cutoff },
    },
    order: [
      ['started_at', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const endedUserIds = new Set();
  for (const session of overdueSessions) {
    if (!shouldAutoEndForMaxDuration(session, serverNow)) continue;

    const result = await finalizeStudySession(session, {
      reason: STUDY_SESSION_END_REASONS.MAX_DURATION,
      endedAt: getMaxDurationEndedAt(session),
    });

    if (result.ended) {
      endedUserIds.add(session.userId);
    }
  }

  if (typeof publishTimerState === 'function') {
    for (const userId of endedUserIds) {
      await publishTimerState(userId);
    }
  }

  return { endedCount: endedUserIds.size };
}
