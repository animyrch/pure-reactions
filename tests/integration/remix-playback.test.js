import { describe, expect, it } from 'vitest';
import { planRemixTransport } from '../../src/lib/helpers/remixPlayback.ts';

describe('planRemixTransport', () => {
  it('plays through when no play or pause cue applies', () => {
    expect(planRemixTransport({
      state: -1,
      anchorTime: 0,
      targetTime: 0,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: null,
    });
  });

  it('pauses at a pause cue without seeking', () => {
    expect(planRemixTransport({
      state: 2,
      anchorTime: 12,
      targetTime: 12,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'pause',
      seekTo: null,
      nextAppliedAnchor: 12,
    });
  });

  it('jumps once when a play cue targets a different original time', () => {
    const first = planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      lastAppliedAnchor: null,
      isUserPaused: false,
    });
    expect(first).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 10,
    });

    expect(planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      lastAppliedAnchor: first.nextAppliedAnchor,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 10,
    });
  });

  it('holds position while the viewer has paused', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      lastAppliedAnchor: null,
      isUserPaused: true,
    })).toEqual({
      transport: 'hold',
      seekTo: null,
      nextAppliedAnchor: null,
    });
  });
});
