/**
 * 测试：srs.js 工具模块的纯函数
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getNextReview,
  addDays,
  todayStr,
  todayStart,
  tomorrowStart,
  MAX_INTERVAL,
  buildDueSchedule,
} from '../utils/srs.js';

describe('srs.js 工具模块', () => {
  describe('getNextReview', () => {
    it('quality=1 (again): interval=0, status=learning', () => {
      const r = getNextReview(1, 10, 2.5);
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
      expect(r.easeFactor).toBeCloseTo(2.3);
      expect(r.perfectStreakCount).toBe(0);
    });

    it('quality=1 easeFactor 不低于 1.3', () => {
      const r = getNextReview(1, 5, 1.3);
      expect(r.easeFactor).toBe(1.3);
      expect(r.delayMinutes).toBe(0);
    });

    it('quality=2 (hard): 新词 10 分钟后再复习', () => {
      const r = getNextReview(2, 0, 2.5);
      expect(r.interval).toBe(0);
      expect(r.delayMinutes).toBe(10);
      expect(r.easeFactor).toBeCloseTo(2.35);
    });

    it('quality=2 (hard): 老词 interval=ceil(current*1.2)', () => {
      const r = getNextReview(2, 10, 2.5);
      expect(r.interval).toBe(12);
    });

    it('quality=3 (good): 新词 10 分钟后进入学习阶段验证', () => {
      const r = getNextReview(3, 0, 2.5, 'new');
      expect(r.interval).toBe(0);
      expect(r.delayMinutes).toBe(10);
      expect(r.easeFactor).toBe(2.5);
      expect(r.status).toBe('learning');
    });

    it('quality=3 (good): 老词 interval=ceil(current*ease)', () => {
      const r = getNextReview(3, 10, 2.5);
      expect(r.interval).toBe(25);
    });

    it('quality=4 (easy): 新词 4 小时后再次验证', () => {
      const r = getNextReview(4, 0, 2.5, 'new');
      expect(r.interval).toBe(0);
      expect(r.delayMinutes).toBe(4 * 60);
      expect(r.easeFactor).toBeCloseTo(2.65);
      expect(r.status).toBe('learning');
    });

    it('quality=4 (easy): 老词大幅增加间隔', () => {
      const r = getNextReview(4, 10, 2.5);
      expect(r.interval).toBe(Math.ceil(10 * 2.5 * 1.3));
      expect(r.perfectStreakCount).toBe(1);
    });

    it('interval 不超过 MAX_INTERVAL', () => {
      const r = getNextReview(4, 300, 2.5);
      expect(r.interval).toBe(MAX_INTERVAL);
    });

    it('quality=4 连续第 3 次时 status=known', () => {
      const r = getNextReview(4, 15, 2.5, 'review', 2, 2, 2);
      expect(r.perfectStreakCount).toBe(3);
      expect(r.status).toBe('known');
    });

    it('known + quality=4 仍保持 known', () => {
      const r = getNextReview(4, 15, 2.5, 'known', 2, 2, 0);
      expect(r.status).toBe('known');
      expect(r.perfectStreakCount).toBe(1);
    });

    it('quality=3 会重置连续 4 分计数', () => {
      const r = getNextReview(3, 21, 2.5, 'review', 2, 2, 2);
      expect(r.status).toBe('review');
      expect(r.perfectStreakCount).toBe(0);
    });

    it('quality=2(hard) 即使连续次数很高也不会直接升 known', () => {
      const r = getNextReview(2, 30, 2.5, 'review', 10, 10, 2);
      expect(r.interval).toBe(Math.ceil(30 * 1.2));
      expect(r.status).toBe('review');
      expect(r.perfectStreakCount).toBe(0);
    });

    it('quality=4 但连续次数不足 3 次时 status=review', () => {
      const r = getNextReview(4, 2, 2.5, 'review', 0, 0, 1);
      expect(r.status).toBe('review');
      expect(r.perfectStreakCount).toBe(2);
    });

    // 学习阶段测试
    it('learning + quality=3: 毕业到 review，1 天后复习', () => {
      const r = getNextReview(3, 1, 2.5, 'learning');
      expect(r.interval).toBe(1);
      expect(r.delayMinutes).toBe(24 * 60);
      expect(r.status).toBe('review');
    });

    it('learning + quality=1: 保持 learning，interval=0', () => {
      const r = getNextReview(1, 1, 2.5, 'learning');
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
    });

    it('learning + quality=4: 毕业到 review，2 天后复习', () => {
      const r = getNextReview(4, 1, 2.5, 'learning');
      expect(r.interval).toBe(2);
      expect(r.delayMinutes).toBe(2 * 24 * 60);
      expect(r.status).toBe('review');
      expect(r.perfectStreakCount).toBe(1);
    });

    it('new + quality=1: 保持 learning', () => {
      const r = getNextReview(1, 0, 2.5, 'new');
      expect(r.interval).toBe(0);
      expect(r.delayMinutes).toBe(0);
      expect(r.status).toBe('learning');
    });

    it('new + quality=2: interval=0, learning', () => {
      const r = getNextReview(2, 0, 2.5, 'new');
      expect(r.interval).toBe(0);
      expect(r.delayMinutes).toBe(10);
      expect(r.status).toBe('learning');
    });

    it('review + quality=1: 打回 learning', () => {
      const r = getNextReview(1, 10, 2.5, 'review');
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
    });
  });

  describe('addDays', () => {
    it('增加正整数天', () => {
      expect(addDays('2024-01-01', 3)).toBe('2024-01-04');
    });

    it('跨月', () => {
      expect(addDays('2024-01-30', 3)).toBe('2024-02-02');
    });

    it('增加 0 天', () => {
      expect(addDays('2024-06-15', 0)).toBe('2024-06-15');
    });

    it('跨年', () => {
      expect(addDays('2024-12-30', 5)).toBe('2025-01-04');
    });
  });

  describe('todayStr', () => {
    it('无参数时返回 YYYY-MM-DD 格式', () => {
      const result = todayStr();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('有效时区返回 YYYY-MM-DD 格式', () => {
      const result = todayStr('Asia/Shanghai');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('无效时区回退到 UTC', () => {
      const result = todayStr('Invalid/Timezone');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('todayStart', () => {
    it('返回 Date 对象', () => {
      const result = todayStart();
      expect(result).toBeInstanceOf(Date);
    });

    it('时间部分为 00:00:00（本地时间）', () => {
      const result = todayStart();
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('有效时区返回该时区当天的零点', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-08T01:00:00Z'));

      try {
        const result = todayStart('Asia/Shanghai');
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23',
          })
            .formatToParts(result)
            .map((part) => [part.type, part.value])
        );

        expect(`${parts.year}-${parts.month}-${parts.day}`).toBe('2026-04-08');
        expect(`${parts.hour}:${parts.minute}:${parts.second}`).toBe('00:00:00');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('tomorrowStart', () => {
    it('返回下一天的零点', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-08T01:00:00Z'));

      try {
        const result = tomorrowStart('Asia/Shanghai');
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23',
          })
            .formatToParts(result)
            .map((part) => [part.type, part.value])
        );

        expect(`${parts.year}-${parts.month}-${parts.day}`).toBe('2026-04-09');
        expect(`${parts.hour}:${parts.minute}:${parts.second}`).toBe('00:00:00');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('buildDueSchedule', () => {
    it('按时区从分钟级延迟生成 dueAt 和 dueDate', () => {
      const base = new Date('2026-04-09T15:55:00Z');
      const result = buildDueSchedule(10, 'Asia/Shanghai', base);

      expect(result.dueAt.toISOString()).toBe('2026-04-09T16:05:00.000Z');
      expect(result.dueDate).toBe('2026-04-10');
    });
  });
});
