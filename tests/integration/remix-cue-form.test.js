import { describe, expect, it } from 'vitest';
import { floorSkipToOriginalAt, nextPlayTargetAfterStartMove } from '../../src/lib/helpers/remixCueForm.ts';

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

describe('play cue moved by reaction start', () => {
  it('floors a remix play cue to the new start when its skip target is earlier', () => {
    expect(nextPlayTargetAfterStartMove({
      remixMode: true,
      state: 1,
      cueTime: 758,
      targetTime: 0,
    })).toBe(758);
  });

  it('keeps a remix play cue that already skips to the start or later', () => {
    expect(nextPlayTargetAfterStartMove({
      remixMode: true,
      state: 1,
      cueTime: 758,
      targetTime: 758,
    })).toBe(758);
    expect(nextPlayTargetAfterStartMove({
      remixMode: true,
      state: 1,
      cueTime: 758,
      targetTime: 900,
    })).toBe(900);
  });

  it('leaves reaction-clock cues and non-play cues unchanged', () => {
    expect(nextPlayTargetAfterStartMove({
      remixMode: false,
      state: 1,
      cueTime: 758,
      targetTime: 0,
    })).toBe(0);
    expect(nextPlayTargetAfterStartMove({
      remixMode: true,
      state: 2,
      cueTime: 758,
      targetTime: 758,
    })).toBe(758);
  });
});
