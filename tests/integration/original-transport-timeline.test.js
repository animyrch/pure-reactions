import { describe, it, expect } from 'vitest';
import {
  buildOriginalTransportTimeline,
  getOriginalTransportStateAt,
} from '../../src/lib/helpers/originalTransportTimeline.ts';

describe('buildOriginalTransportTimeline', () => {
  it('returns empty array for null or non-array input', () => {
    expect(buildOriginalTransportTimeline(null)).toEqual([]);
    expect(buildOriginalTransportTimeline(undefined)).toEqual([]);
    expect(buildOriginalTransportTimeline({})).toEqual([]);
    expect(buildOriginalTransportTimeline([])).toEqual([]);
  });

  it('includes only state 1 (playing) and state 2 (paused) entries', () => {
    const stateTimeline = [
      { t: 0.0, state: 2, targetTime: 0 },   // paused — keep
      { t: 5.5, state: 1, targetTime: 5.5 }, // playing — keep
      { t: 10.0, state: 3, targetTime: 10 }, // buffering — drop
      { t: 15.0, state: 0, targetTime: 15 }, // ended — drop
      { t: 20.0, state: 2, targetTime: 20 }, // paused — keep
    ];

    const result = buildOriginalTransportTimeline(stateTimeline);

    expect(result).toEqual([
      { t: 0.0, state: 2 },
      { t: 5.5, state: 1 },
      { t: 20.0, state: 2 },
    ]);
  });

  it('strips targetTime from each entry', () => {
    const stateTimeline = [
      { t: 3.0, state: 1, targetTime: 42.1 },
      { t: 8.0, state: 2, targetTime: 50.3 },
    ];
    const result = buildOriginalTransportTimeline(stateTimeline);
    expect(result.every((e) => !('targetTime' in e))).toBe(true);
    expect(result).toEqual([
      { t: 3.0, state: 1 },
      { t: 8.0, state: 2 },
    ]);
  });

  it('sorts results ascending by t even if input is unsorted', () => {
    const stateTimeline = [
      { t: 20.0, state: 2, targetTime: 0 },
      { t: 5.0, state: 1, targetTime: 0 },
      { t: 0.0, state: 2, targetTime: 0 },
    ];
    const result = buildOriginalTransportTimeline(stateTimeline);
    expect(result.map((e) => e.t)).toEqual([0.0, 5.0, 20.0]);
  });

  it('is idempotent — re-running on already-migrated data yields the same result', () => {
    const stateTimeline = [
      { t: 0.0, state: 2, targetTime: 0 },
      { t: 5.5, state: 1, targetTime: 5.5 },
    ];
    const first = buildOriginalTransportTimeline(stateTimeline);
    const second = buildOriginalTransportTimeline(first);
    expect(second).toEqual(first);
  });

  it('skips entries with non-finite t', () => {
    const stateTimeline = [
      { t: NaN, state: 1, targetTime: 0 },
      { t: undefined, state: 2, targetTime: 0 },
      { t: 4.0, state: 1, targetTime: 4 },
    ];
    const result = buildOriginalTransportTimeline(stateTimeline);
    expect(result).toEqual([{ t: 4.0, state: 1 }]);
  });

  it('skips null/undefined entries', () => {
    const stateTimeline = [null, undefined, { t: 2.0, state: 1, targetTime: 0 }];
    const result = buildOriginalTransportTimeline(stateTimeline);
    expect(result).toEqual([{ t: 2.0, state: 1 }]);
  });

  it('preserves behaviour for a full realistic stateTimeline', () => {
    const stateTimeline = [
      { t: 0.0,  state: 2, targetTime: 0 },   // start paused
      { t: 0.5,  state: 1, targetTime: 0.5 }, // play
      { t: 30.2, state: 2, targetTime: 30.2 }, // pause
      { t: 30.9, state: 1, targetTime: 30.9 }, // play
      { t: 60.0, state: 3, targetTime: 60 },   // buffering — drop
      { t: 61.0, state: 1, targetTime: 61 },   // play (after buffer)
      { t: 90.0, state: 0, targetTime: 90 },   // ended — drop
    ];

    const result = buildOriginalTransportTimeline(stateTimeline);

    expect(result).toEqual([
      { t: 0.0,  state: 2 },
      { t: 0.5,  state: 1 },
      { t: 30.2, state: 2 },
      { t: 30.9, state: 1 },
      { t: 61.0, state: 1 },
    ]);
  });
});

describe('getOriginalTransportStateAt', () => {
  const timeline = [
    { t: 0.0, state: 2 }, // paused at start
    { t: 5.0, state: 1 }, // playing from 5s
    { t: 30.0, state: 2 }, // paused from 30s
    { t: 35.0, state: 1 }, // playing from 35s
  ];

  it('returns null for empty timeline', () => {
    expect(getOriginalTransportStateAt(10, [])).toBeNull();
  });

  it('returns null for null/non-array timeline', () => {
    expect(getOriginalTransportStateAt(10, null)).toBeNull();
  });

  it('returns null before the first event', () => {
    const timelineStartingLate = [{ t: 5.0, state: 1 }];
    expect(getOriginalTransportStateAt(2.0, timelineStartingLate)).toBeNull();
  });

  it('returns the state at exactly the first event time', () => {
    expect(getOriginalTransportStateAt(0.0, timeline)).toBe(2); // paused
  });

  it('returns the correct state between two events', () => {
    expect(getOriginalTransportStateAt(10.0, timeline)).toBe(1); // playing (after 5s)
    expect(getOriginalTransportStateAt(31.0, timeline)).toBe(2); // paused (after 30s)
    expect(getOriginalTransportStateAt(36.0, timeline)).toBe(1); // playing (after 35s)
  });

  it('returns the state at exactly an event boundary', () => {
    expect(getOriginalTransportStateAt(30.0, timeline)).toBe(2);
    expect(getOriginalTransportStateAt(35.0, timeline)).toBe(1);
  });

  it('applies timeOffset correctly', () => {
    // With timeOffset=5, reaction time 10 maps to effective time 5 → playing
    expect(getOriginalTransportStateAt(10.0, timeline, 5.0)).toBe(1);
    // Reaction time 33 maps to effective time 28 → still playing (between 5 and 30)
    expect(getOriginalTransportStateAt(33.0, timeline, 5.0)).toBe(1);
    // Reaction time 36 maps to effective time 31 → paused (after 30)
    expect(getOriginalTransportStateAt(36.0, timeline, 5.0)).toBe(2);
  });
});

describe('Transport Track migration preserves playback behaviour', () => {
  it('produces the same play/pause sequence as filtering stateTimeline entries', () => {
    const stateTimeline = [
      { t: 0.0,  state: 2, targetTime: 0 },
      { t: 1.0,  state: 1, targetTime: 1 },
      { t: 45.5, state: 2, targetTime: 45.5 },
      { t: 50.0, state: 1, targetTime: 50 },
      { t: 55.0, state: 3, targetTime: 55 }, // buffering, should be dropped
    ];

    const transport = buildOriginalTransportTimeline(stateTimeline);

    // Verify state sequence matches what stateTimeline filter would produce
    const legacyFiltered = stateTimeline
      .filter((e) => e.state === 1 || e.state === 2)
      .map(({ t, state }) => ({ t, state }))
      .sort((a, b) => a.t - b.t);

    expect(transport).toEqual(legacyFiltered);
  });
});
