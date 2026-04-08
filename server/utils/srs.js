export const MAX_INTERVAL = 365;
export const MINUTES_PER_DAY = 24 * 60;

export const REVIEW_STATUS = Object.freeze({
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  KNOWN: 'known',
});

export const KNOWN_STATUS_THRESHOLD = 21;

const SHORT_LEARNING_STEPS = Object.freeze({
  NEW_HARD: 10,
  NEW_GOOD: 10,
  NEW_EASY: 4 * 60,
  LEARNING_HARD: 1 * MINUTES_PER_DAY,
  LEARNING_GOOD: 1 * MINUTES_PER_DAY,
  LEARNING_EASY: 2 * MINUTES_PER_DAY,
});

export function getNextReview(quality, currentInterval, easeFactor, currentStatus) {
  const isNew =
    currentStatus === REVIEW_STATUS.NEW ||
    (currentStatus === undefined && currentInterval < 1);
  const isLearning = currentStatus === REVIEW_STATUS.LEARNING;

  if (isNew) {
    // 新词：首次见面先走短间隔台阶，避免答一次就消失到明天。
    if (quality === 1) {
      return {
        interval: 0,
        delayMinutes: 0,
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        status: REVIEW_STATUS.LEARNING,
      };
    }
    if (quality === 2) {
      return {
        interval: 0,
        delayMinutes: SHORT_LEARNING_STEPS.NEW_HARD,
        easeFactor: Math.max(1.3, easeFactor - 0.15),
        status: REVIEW_STATUS.LEARNING,
      };
    }
    if (quality === 3) {
      return {
        interval: 0,
        delayMinutes: SHORT_LEARNING_STEPS.NEW_GOOD,
        easeFactor,
        status: REVIEW_STATUS.LEARNING,
      };
    }
    return {
      interval: 0,
      delayMinutes: SHORT_LEARNING_STEPS.NEW_EASY,
      easeFactor: easeFactor + 0.15,
      status: REVIEW_STATUS.LEARNING,
    };
  }

  if (isLearning) {
    // 学习中：完成第二个台阶后再毕业到正式复习阶段。
    if (quality === 1) {
      return {
        interval: 0,
        delayMinutes: 0,
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        status: REVIEW_STATUS.LEARNING,
      };
    }
    if (quality === 2) {
      return {
        interval: 1,
        delayMinutes: SHORT_LEARNING_STEPS.LEARNING_HARD,
        easeFactor: Math.max(1.3, easeFactor - 0.15),
        status: REVIEW_STATUS.LEARNING,
      };
    }
    if (quality === 3) {
      return {
        interval: 1,
        delayMinutes: SHORT_LEARNING_STEPS.LEARNING_GOOD,
        easeFactor,
        status: REVIEW_STATUS.REVIEW,
      };
    }
    return {
      interval: 2,
      delayMinutes: SHORT_LEARNING_STEPS.LEARNING_EASY,
      easeFactor: easeFactor + 0.15,
      status: REVIEW_STATUS.REVIEW,
    };
  }

  // review / known 阶段 —— 正式间隔复习
  let newInterval;
  let newEase;

  if (quality === 1) {
    // 忘了，打回学习阶段
    return {
      interval: 0,
      delayMinutes: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      status: REVIEW_STATUS.LEARNING,
    };
  } else if (quality === 2) {
    newInterval = Math.max(1, Math.ceil(currentInterval * 1.2));
    newEase = Math.max(1.3, easeFactor - 0.15);
  } else if (quality === 3) {
    newInterval = Math.ceil(currentInterval * easeFactor);
    newEase = easeFactor;
  } else {
    newInterval = Math.ceil(currentInterval * easeFactor * 1.3);
    newEase = easeFactor + 0.15;
  }

  newInterval = Math.min(newInterval, MAX_INTERVAL);
  const status = newInterval >= KNOWN_STATUS_THRESHOLD ? REVIEW_STATUS.KNOWN : REVIEW_STATUS.REVIEW;
  return {
    interval: newInterval,
    delayMinutes: newInterval * MINUTES_PER_DAY,
    easeFactor: newEase,
    status,
  };
}

export function todayStr(timezone) {
  return dateStrAt(new Date(), timezone);
}

export function dateStrAt(date, timezone) {
  if (timezone) {
    try {
      return new Date(date).toLocaleDateString('en-CA', { timeZone: timezone });
    } catch {
      /* invalid tz, fallback */
    }
  }
  return new Date(date).toISOString().slice(0, 10);
}

function getTimeZoneParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function getTimeZoneOffsetMs(date, timezone) {
  const parts = getTimeZoneParts(date, timezone);
  const zonedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return zonedUtc - date.getTime();
}

export function todayStart(timezone) {
  const today = todayStr(timezone);
  if (!timezone) {
    return new Date(today + 'T00:00:00');
  }

  try {
    const [year, month, day] = today.split('-').map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
    const offset = getTimeZoneOffsetMs(new Date(utcMidnight), timezone);
    return new Date(utcMidnight - offset);
  } catch {
    return new Date(today + 'T00:00:00');
  }
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

export function buildDueSchedule(delayMinutes, timezone, now = new Date()) {
  const dueAt = addMinutes(now, delayMinutes);
  return {
    dueAt,
    dueDate: dateStrAt(dueAt, timezone),
  };
}
