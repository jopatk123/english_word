import { Op } from 'sequelize';
import { StudySession } from '../models/index.js';
import { MAX_SESSION_DURATION_SECONDS } from '../constants/study-session.js';
import { settleActiveSessionIfNeeded } from './study-session-lifecycle.js';

export async function findActiveStudySession(userId) {
  return StudySession.findOne({
    where: { userId, endedAt: null },
    order: [
      ['started_at', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

export async function findLatestStudySession(userId) {
  return StudySession.findOne({
    where: { userId },
    order: [
      ['updated_at', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

export async function closeOtherActiveStudySessions(userId, keepSessionId) {
  if (!keepSessionId) return;

  await StudySession.update(
    {
      endedAt: new Date(),
      durationSeconds: 0,
    },
    {
      where: {
        userId,
        endedAt: null,
        id: { [Op.ne]: keepSessionId },
      },
    }
  );
}

function toIsoString(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function getStateChangedAtMs(session) {
  if (!session) return 0;

  const candidate = session.updatedAt ?? session.endedAt ?? session.startedAt;
  const stateChangedAtMs = new Date(candidate).getTime();
  return Number.isFinite(stateChangedAtMs) ? stateChangedAtMs : 0;
}

export function buildStudyTimerState({
  activeSession = null,
  lastSession = null,
  serverNow = new Date(),
}) {
  const session = activeSession || lastSession || null;
  const isRunning = Boolean(activeSession);
  const stateChangedAtMs = getStateChangedAtMs(session);
  const sessionId = isRunning ? activeSession.id : null;
  const startedAtMs = isRunning ? new Date(activeSession.startedAt).getTime() : NaN;
  const elapsedSeconds =
    isRunning && Number.isFinite(startedAtMs)
      ? Math.min(
          MAX_SESSION_DURATION_SECONDS,
          Math.max(0, Math.floor((serverNow.getTime() - startedAtMs) / 1000))
        )
      : 0;

  return {
    isRunning,
    sessionId,
    startedAt: isRunning ? toIsoString(activeSession.startedAt) : null,
    elapsedSeconds,
    serverNow: serverNow.toISOString(),
    stateChangedAtMs,
    revision: `${stateChangedAtMs}:${session?.id ?? 0}:${isRunning ? 1 : 0}`,
  };
}

export async function getStudyTimerState(userId, options = {}) {
  const settlement = await settleActiveSessionIfNeeded(userId, {
    serverNow: options.serverNow,
    publishTimerState: options.publishTimerState,
    activeSession: options.activeSession,
  });

  const activeSession =
    settlement.session ??
    (settlement.settled ? null : (options.activeSession ?? (await findActiveStudySession(userId))));
  const lastSession =
    options.lastSession ??
    (activeSession
      ? activeSession
      : (settlement.endedSession ?? (await findLatestStudySession(userId))));

  return buildStudyTimerState({
    activeSession,
    lastSession,
    serverNow: options.serverNow,
  });
}
