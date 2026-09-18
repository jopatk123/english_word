import { describe, expect, it } from 'vitest';
import { getVisualViewportInset } from '../useVisualViewportInset.js';

describe('getVisualViewportInset', () => {
  it('returns 0 when visualViewport is missing', () => {
    expect(getVisualViewportInset(undefined, 800)).toBe(0);
  });

  it('records the occluded height from visualViewport', () => {
    expect(
      getVisualViewportInset(
        {
          height: 500,
          offsetTop: 40,
        },
        800
      )
    ).toBe(260);
  });
});
