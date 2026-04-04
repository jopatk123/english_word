/**
 * 测试：srs.js 工具模块的纯函数
 */
import { describe, it, expect } from 'vitest';
import { getNextReview, addDays, todayStr, todayStart, MAX_INTERVAL } from '../utils/srs.js';

describe('srs.js 工具模块', () => {
  describe('getNextReview', () => {
    it('quality=1 (again): interval=0, status=learning', () => {
      const r = getNextReview(1, 10, 2.5);
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
      expect(r.easeFactor).toBeCloseTo(2.3);
    });

    it('quality=1 easeFactor 不低于 1.3', () => {
      const r = getNextReview(1, 5, 1.3);
      expect(r.easeFactor).toBe(1.3);
    });

    it('quality=2 (hard): 新词 interval=1', () => {
      const r = getNextReview(2, 0, 2.5);
      expect(r.interval).toBe(1);
      expect(r.easeFactor).toBeCloseTo(2.35);
    });

    it('quality=2 (hard): 老词 interval=ceil(current*1.2)', () => {
      const r = getNextReview(2, 10, 2.5);
      expect(r.interval).toBe(12);
    });

    it('quality=3 (good): 新词 interval=1（进入学习阶段验证）', () => {
      const r = getNextReview(3, 0, 2.5, 'new');
      expect(r.interval).toBe(1);
      expect(r.easeFactor).toBe(2.5);
      expect(r.status).toBe('learning');
    });

    it('quality=3 (good): 老词 interval=ceil(current*ease)', () => {
      const r = getNextReview(3, 10, 2.5);
      expect(r.interval).toBe(25);
    });

    it('quality=4 (easy): 新词 interval=4（跳过学习阶段）', () => {
      const r = getNextReview(4, 0, 2.5, 'new');
      expect(r.interval).toBe(4);
      expect(r.easeFactor).toBeCloseTo(2.65);
      expect(r.status).toBe('review');
    });

    it('quality=4 (easy): 老词大幅增加间隔', () => {
      const r = getNextReview(4, 10, 2.5);
      expect(r.interval).toBe(Math.ceil(10 * 2.5 * 1.3));
    });

    it('interval 不超过 MAX_INTERVAL', () => {
      const r = getNextReview(4, 300, 2.5);
      expect(r.interval).toBe(MAX_INTERVAL);
    });

    it('interval >= 21 时 status=known', () => {
      const r = getNextReview(3, 10, 2.5, 'review');
      expect(r.interval).toBe(25);
      expect(r.status).toBe('known');
    });

    it('interval < 21 且 quality > 1 时 status=review', () => {
      const r = getNextReview(3, 2, 2.5, 'review');
      expect(r.interval).toBe(5);
      expect(r.status).toBe('review');
    });

    // 学习阶段测试
    it('learning + quality=3: 毕业到 review，interval=3', () => {
      const r = getNextReview(3, 1, 2.5, 'learning');
      expect(r.interval).toBe(3);
      expect(r.status).toBe('review');
    });

    it('learning + quality=1: 保持 learning，interval=0', () => {
      const r = getNextReview(1, 1, 2.5, 'learning');
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
    });

    it('learning + quality=4: 毕业到 review，interval=7', () => {
      const r = getNextReview(4, 1, 2.5, 'learning');
      expect(r.interval).toBe(7);
      expect(r.status).toBe('review');
    });

    it('new + quality=1: 保持 learning', () => {
      const r = getNextReview(1, 0, 2.5, 'new');
      expect(r.interval).toBe(0);
      expect(r.status).toBe('learning');
    });

    it('new + quality=2: interval=1, learning', () => {
      const r = getNextReview(2, 0, 2.5, 'new');
      expect(r.interval).toBe(1);
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
  });
});
