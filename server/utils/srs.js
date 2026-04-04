export const MAX_INTERVAL = 365;

export function getNextReview(quality, currentInterval, easeFactor, currentStatus) {
  const isNew = currentStatus === 'new' || (currentStatus === undefined && currentInterval < 1);
  const isLearning = currentStatus === 'learning';

  if (isNew) {
    // 新词：首次见面，需要进入学习阶段验证
    if (quality === 1) {
      return {
        interval: 0,
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        status: 'learning',
      };
    }
    if (quality === 2) {
      return {
        interval: 1,
        easeFactor: Math.max(1.3, easeFactor - 0.15),
        status: 'learning',
      };
    }
    if (quality === 3) {
      // 认识但还需明天验证一次
      return { interval: 1, easeFactor, status: 'learning' };
    }
    // quality === 4: 很熟悉，跳过学习阶段直接毕业
    return { interval: 4, easeFactor: easeFactor + 0.15, status: 'review' };
  }

  if (isLearning) {
    // 学习中：需要再次验证才能毕业到正式复习
    if (quality === 1) {
      return {
        interval: 0,
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        status: 'learning',
      };
    }
    if (quality === 2) {
      return {
        interval: 1,
        easeFactor: Math.max(1.3, easeFactor - 0.15),
        status: 'learning',
      };
    }
    if (quality === 3) {
      // 毕业！进入正式复习
      return { interval: 3, easeFactor, status: 'review' };
    }
    // quality === 4: 毕业且加分
    return { interval: 7, easeFactor: easeFactor + 0.15, status: 'review' };
  }

  // review / known 阶段 —— 正式间隔复习
  let newInterval;
  let newEase;

  if (quality === 1) {
    // 忘了，打回学习阶段
    return {
      interval: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      status: 'learning',
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
  const status = newInterval >= 21 ? 'known' : 'review';
  return { interval: newInterval, easeFactor: newEase, status };
}

export function todayStr(timezone) {
  if (timezone) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    } catch {
      /* invalid tz, fallback */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function todayStart(timezone) {
  const today = todayStr(timezone);
  return new Date(today + 'T00:00:00');
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
