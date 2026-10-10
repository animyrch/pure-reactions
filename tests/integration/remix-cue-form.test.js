import { describe, expect, it } from 'vitest';
import { floorSkipToOriginalAt } from '../../src/lib/helpers/remixCueForm.ts';

describe('remix cue form skip floor', () => {
  it('replaces a skip that is earlier than original at', () => {
    expect(floorSkipToOriginalAt(30, 5)).toBe(30);
    expect(floorSkipToOriginalAt(200, 180)).toBe(200);
    expect(floorSkipToOriginalAt(90.5, 90)).toBe(90.5);
  });

  it('keeps a skip that matches or is later than original at', () => {
    expect(floorSkipToOriginalAt(30, 30)).toBe(30);
    expect(floorSkipToOriginalAt(30, 75)).toBe(75);
    expect(floorSkipToOriginalAt(0, 0)).toBe(0);
  });

  it('leaves a non-finite skip unchanged', () => {
    expect(floorSkipToOriginalAt(30, Number.NaN)).toBeNaN();
    expect(floorSkipToOriginalAt(Number.NaN, 12)).toBe(12);
  });
});
