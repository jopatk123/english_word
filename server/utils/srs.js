export const MAX_INTERVAL = 365;

export function getNextReview(quality, currentInterval, easeFactor) {
  let newInterval;
  let newEase = easeFactor;
  const isNew = currentInterval < 1;

  if (quality === 1) {
    newInterval = 0;
    newEase = Math.max(1.3, easeFactor - 0.2);
  } else if (quality === 2) {
    newInterval = isNew ? 1 : Math.max(1, Math.ceil(currentInterval * 1.2));
    newEase = Math.max(1.3, easeFactor - 0.15);
  } else if (quality === 3) {
    newInterval = isNew ? 3 : Math.ceil(currentInterval * easeFactor);
    newEase = easeFactor;
  } else {
    newInterval = isNew ? 7 : Math.ceil(currentInterval * easeFactor * 1.3);
    newEase = easeFactor + 0.15;
  }

  newInterval = Math.min(newInterval, MAX_INTERVAL);
  const status = quality === 1 ? 'learning' : (newInterval >= 21 ? 'known' : 'review');
  return { interval: newInterval, easeFactor: newEase, status };
}

export function todayStr(timezone) {
  if (timezone) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    } catch { /* invalid tz, fallback */ }
  }
  return new Date().toISOString().slice(0, 10);
}

export function todayStartUTC(timezone) {
  const today = todayStr(timezone);
  return new Date(today + 'T00:00:00');
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
