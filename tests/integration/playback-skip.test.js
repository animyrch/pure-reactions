import { describe, expect, it } from 'vitest';
import {
  COARSE_SKIP_SECONDS,
  FINE_SKIP_SECONDS,
  clampPlaybackTime,
  playbackSkipDelta,
} from '../../src/lib/helpers/playbackSkip.ts';

describe('playback skip shortcuts', () => {
  it('uses J and L for a 15 second jump', () => {
    expect(playbackSkipDelta({ key: 'j' })).toBe(-COARSE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'J' })).toBe(-COARSE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'l' })).toBe(COARSE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'L' })).toBe(COARSE_SKIP_SECONDS);
    expect(COARSE_SKIP_SECONDS).toBe(15);
  });

  it('keeps unmodified arrows at 5 seconds and shift+arrow at 15', () => {
    expect(playbackSkipDelta({ key: 'ArrowLeft' })).toBe(-FINE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'ArrowRight' })).toBe(FINE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'ArrowLeft', shiftKey: true })).toBe(-COARSE_SKIP_SECONDS);
    expect(playbackSkipDelta({ key: 'ArrowRight', shiftKey: true })).toBe(COARSE_SKIP_SECONDS);
    expect(FINE_SKIP_SECONDS).toBe(5);
  });

  it('ignores unrelated keys', () => {
    expect(playbackSkipDelta({ key: 'k' })).toBeNull();
    expect(playbackSkipDelta({ key: ' ' })).toBeNull();
    expect(playbackSkipDelta({ key: 'ArrowUp' })).toBeNull();
  });

  it('clamps a skip to the playback range', () => {
    expect(clampPlaybackTime(10 - 15, 0, 90)).toBe(0);
    expect(clampPlaybackTime(80 + 15, 0, 90)).toBe(90);
    expect(clampPlaybackTime(20 + 15, 5, 40)).toBe(35);
    expect(clampPlaybackTime(Number.NaN, 4, 40)).toBe(4);
  });
});
