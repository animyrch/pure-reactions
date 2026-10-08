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
      currentTime: 10.2,
      previousTime: 9.6,
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
      currentTime: 40.2,
      previousTime: first.seekTo,
      lastAppliedAnchor: first.nextAppliedAnchor,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 10,
    });
  });

  it('jumps when the first sample is already past the play cue', () => {
    const first = planRemixTransport({
      state: 1,
      anchorTime: 0.4,
      targetTime: 40,
      currentTime: 2,
      previousTime: null,
      playbackOrigin: 0,
      lastAppliedAnchor: null,
      isUserPaused: false,
    });
    expect(first).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 0.4,
    });

    expect(planRemixTransport({
      state: 1,
      anchorTime: 0.4,
      targetTime: 40,
      currentTime: 40.3,
      previousTime: first.seekTo,
      playbackOrigin: first.seekTo,
      lastAppliedAnchor: first.nextAppliedAnchor,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 0.4,
    });
  });

  it('does not fire a cue that sits behind the last intentional position', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 8,
      targetTime: 50,
      currentTime: 25.2,
      previousTime: 25,
      playbackOrigin: 20,
      lastAppliedAnchor: 1,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 8,
    });
  });

  it('does not fire a later play cue when the clock is already past it', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 8,
      targetTime: 50,
      currentTime: 25,
      previousTime: 25,
      lastAppliedAnchor: 1,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 8,
    });
  });

  it('jumps when playback moves across a play cue', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 5,
      targetTime: 40,
      currentTime: 5.2,
      previousTime: 4.6,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 5,
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
