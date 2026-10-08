/** 休息提醒可选时长（分钟）。最长一项与服务端单次会话硬上限一致。 */
export const STUDY_TIMER_ALARM_PRESETS = [15, 30, 45, 60, 120];

export const DEFAULT_ALARM_MINUTES = 30;

export function normalizeAlarmMinutes(value) {
  const minutes = Number(value);
  return STUDY_TIMER_ALARM_PRESETS.includes(minutes) ? minutes : DEFAULT_ALARM_MINUTES;
}
