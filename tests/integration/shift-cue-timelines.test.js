import { describe, expect, it } from 'vitest';
import {
  getCurrentOverlaySnapshotFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs
} from '../../src/lib/helpers/reaction.js';
import { shiftCueTimelinesByLeadIn } from '../../src/lib/helpers/shiftCueTimelines.ts';

const sampleTimelines = () => ({
  stateTimeline: [
    { t: 0, state: 1, targetTime: 0 },
    { t: 396.6, state: 2, targetTime: 0 }
  ],
  volumeTimeline: [
    { t: 0, volume: 20 },
    { t: 396.5, volume: 100 }
  ],
  reactionVolumeTimeline: [
    { t: 0, volume: 100 },
    { t: 396.5, volume: 20 }
  ],
  playbackRateTimeline: [
    { t: 0, rate: 1 },
    { t: 50, rate: 1.5 }
  ],
  overlayVisibilityTimeline: [
    { t: 0, visible: true, primary: 'original' },
    { t: 80, visible: false, primary: 'reaction' }
  ]
});

describe('shiftCueTimelinesByLeadIn', () => {
  it('moves every track later and keeps cue values', () => {
    const shifted = shiftCueTimelinesByLeadIn(sampleTimelines(), 120);

    expect(shifted.stateTimeline).toEqual([
      { t: 120, state: 1, targetTime: 0 },
      { t: 516.6, state: 2, targetTime: 0 }
    ]);
    expect(shifted.volumeTimeline).toEqual([
      { t: 120, volume: 20 },
      { t: 516.5, volume: 100 }
    ]);
    expect(shifted.reactionVolumeTimeline).toEqual([
      { t: 120, volume: 100 },
      { t: 516.5, volume: 20 }
    ]);
    expect(shifted.playbackRateTimeline).toEqual([
      { t: 120, rate: 1 },
      { t: 170, rate: 1.5 }
    ]);
    expect(shifted.overlayVisibilityTimeline).toEqual([
      { t: 120, visible: true, primary: 'original' },
      { t: 200, visible: false, primary: 'reaction' }
    ]);
  });

  it('moves cues earlier when they stay on the timeline', () => {
    const shifted = shiftCueTimelinesByLeadIn(sampleTimelines(), -30);

    expect(shifted.stateTimeline).toEqual([
      { t: -30, state: 1, targetTime: 0 },
      { t: 366.6, state: 2, targetTime: 0 }
    ]);
    expect(shifted.volumeTimeline[1]).toEqual({ t: 366.5, volume: 100 });
    expect(shifted.playbackRateTimeline[1]).toEqual({ t: 20, rate: 1.5 });
  });

  it('keeps cues that land before 0 so a later positive lead-in can restore them', () => {
    const shifted = shiftCueTimelinesByLeadIn(sampleTimelines(), -120);
    const restored = shiftCueTimelinesByLeadIn(shifted, 60);

    expect(shifted.stateTimeline.map((cue) => cue.t)).toEqual([-120, 276.6]);
    expect(shifted.stateTimeline[0]).toEqual({ t: -120, state: 1, targetTime: 0 });
    expect(shifted.volumeTimeline[0]).toEqual({ t: -120, volume: 20 });
    expect(shifted.reactionVolumeTimeline[0]).toEqual({ t: -120, volume: 100 });
    expect(shifted.playbackRateTimeline[0]).toEqual({ t: -120, rate: 1 });
    expect(shifted.overlayVisibilityTimeline[0]).toEqual({
      t: -120,
      visible: true,
      primary: 'original'
    });

    expect(restored.stateTimeline).toEqual([
      { t: -60, state: 1, targetTime: 0 },
      { t: 336.6, state: 2, targetTime: 0 }
    ]);
    expect(restored.volumeTimeline[0]).toEqual({ t: -60, volume: 20 });
  });

  it('keeps the later cue when two cues round onto the same time', () => {
    const shifted = shiftCueTimelinesByLeadIn({
      stateTimeline: [
        { t: 0.14, state: 1, targetTime: 1 },
        { t: 0.16, state: 2, targetTime: 9 }
      ],
      volumeTimeline: [],
      reactionVolumeTimeline: [],
      playbackRateTimeline: [],
      overlayVisibilityTimeline: []
    }, -0.05);

    expect(shifted.stateTimeline).toEqual([
      { t: 0.1, state: 2, targetTime: 9 }
    ]);
  });

  it('returns empty timelines and leaves a zero delta unchanged', () => {
    expect(shiftCueTimelinesByLeadIn(null, -10)).toEqual({
      stateTimeline: [],
      volumeTimeline: [],
      reactionVolumeTimeline: [],
      playbackRateTimeline: [],
      overlayVisibilityTimeline: []
    });

    const timelines = sampleTimelines();
    expect(shiftCueTimelinesByLeadIn(timelines, 0)).toEqual(timelines);
  });
});

describe('cues before 0 are ignored during playback', () => {
  const stateTimeline = [
    { t: -120, state: 1, targetTime: 40 },
    { t: 10, state: 2, targetTime: 4 }
  ];

  it('does not apply a negative play cue at the start', () => {
    const before = getCurrentStateFromStateConfigs(0, stateTimeline, 0);
    expect(before.state).toBe(-1);

    const after = getCurrentStateFromStateConfigs(10, stateTimeline, 0);
    expect(after.state).toBe(2);
    expect(after.time).toBe('4.00');
  });

  it('does not apply a negative volume or overlay cue', () => {
    expect(getCurrentVolumeFromVolumeConfigs(0, [
      { t: -120, volume: 20 },
      { t: 15, volume: 80 }
    ], 1, 0)).toBe(100);

    expect(getCurrentVolumeFromVolumeConfigs(15, [
      { t: -120, volume: 20 },
      { t: 15, volume: 80 }
    ], 1, 0)).toBe(80);

    expect(getCurrentOverlaySnapshotFromConfigs(0, [
      { t: -30, visible: false, primary: 'reaction' },
      { t: 12, visible: true, primary: 'original' }
    ], 0, 'original')).toEqual({ visible: true, primary: 'original' });
  });

  it('ignores a negative key in a legacy config map', () => {
    const result = getCurrentStateFromStateConfigs(0, {
      '-120.0': { state: 1, time: '40.00' },
      '0.0': { state: 2, time: '3.00' }
    }, 0);
    expect(result.state).toBe(2);
    expect(result.time).toBe('3.00');
  });
});
