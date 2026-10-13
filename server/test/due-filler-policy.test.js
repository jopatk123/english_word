import { describe, expect, it } from 'vitest';
import {
  GUARDRAIL_MAX,
  GUARDRAIL_MIN,
  STALE_AFTER_DAYS,
  computeGuardrailCount,
  computeMinDueCount,
} from '../utils/dueFiller.js';

describe('待复习额度计算', () => {
  it('没有学习中单词时不补足，也不保留防饿死名额', () => {
    expect(computeMinDueCount(0)).toBe(0);
    expect(computeMinDueCount(-1)).toBe(0);
    expect(computeGuardrailCount(0)).toBe(0);
  });

  it('补足下限仍是 ceil(learning / 3)', () => {
    expect(computeMinDueCount(1)).toBe(1);
    expect(computeMinDueCount(3)).toBe(1);
    expect(computeMinDueCount(4)).toBe(2);
  });

  it('防饿死名额约为最小 due 的 15%，且夹在 1 到 10', () => {
    expect(STALE_AFTER_DAYS).toBe(21);
    expect(computeGuardrailCount(1)).toBe(GUARDRAIL_MIN);
    expect(computeGuardrailCount(6)).toBe(1);
    expect(computeGuardrailCount(7)).toBe(2);
    expect(computeGuardrailCount(80)).toBe(GUARDRAIL_MAX);
  });
});
